import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;

  const [totalSeries, videoStats, recentVideos] = await Promise.all([
    prisma.series.count({ where: { userId, status: { not: "ARCHIVED" } } }),
    prisma.video.groupBy({
      by: ["status"],
      where: { series: { userId } },
      _count: true,
    }),
    prisma.video.findMany({
      where: { series: { userId } },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { series: { select: { title: true } } },
    }),
  ]);

  const statusCounts = Object.fromEntries(
    videoStats.map((s) => [s.status, s._count])
  );

  return NextResponse.json({
    totalSeries,
    totalVideos: Object.values(statusCounts).reduce((a, b) => a + b, 0),
    publishedVideos: statusCounts.PUBLISHED || 0,
    scheduledVideos: statusCounts.SCHEDULED || 0,
    generatingVideos: statusCounts.GENERATING || 0,
    recentVideos,
  });
}
