import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getChannelStats, getVideoStats } from "@/lib/youtube";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;

  // Check if YouTube is connected
  const account = await prisma.youtubeAccount.findUnique({ where: { userId } });
  if (!account) return NextResponse.json({ connected: false });

  try {
    // Fetch channel stats
    const channelStats = await getChannelStats(userId);

    // Get published videos with YouTube IDs from our DB
    const publishedVideos = await prisma.video.findMany({
      where: { series: { userId }, status: "PUBLISHED", youtubeVideoId: { not: null } },
      select: { id: true, title: true, youtubeVideoId: true, youtubeUrl: true, publishedAt: true },
      orderBy: { publishedAt: "desc" },
      take: 6,
    });

    const ytIds = publishedVideos.map((v) => v.youtubeVideoId!).filter(Boolean);
    const videoStats = await getVideoStats(userId, ytIds);

    // Merge DB data with YouTube stats
    const videos = publishedVideos.map((v) => {
      const yt = videoStats.find((s) => s.youtubeVideoId === v.youtubeVideoId);
      return {
        id: v.id,
        title: v.title,
        youtubeUrl: v.youtubeUrl,
        publishedAt: v.publishedAt,
        views: yt?.views ?? 0,
        likes: yt?.likes ?? 0,
        comments: yt?.comments ?? 0,
        thumbnail: yt?.thumbnail ?? "",
      };
    });

    return NextResponse.json({ connected: true, channel: channelStats, videos });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to fetch analytics";
    return NextResponse.json({ connected: true, error: msg });
  }
}
