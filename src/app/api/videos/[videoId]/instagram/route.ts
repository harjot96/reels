import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadVideoToInstagram } from "@/lib/instagram";

export async function POST(req: NextRequest, { params }: { params: { videoId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const video = await prisma.video.findFirst({
    where: { id: params.videoId, series: { userId } },
    include: { series: true },
  });

  if (!video) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!video.videoUrl) return NextResponse.json({ error: "Video not ready" }, { status: 400 });
  if (video.instagramMediaId) {
    return NextResponse.json({ error: "Already published", instagramUrl: video.instagramUrl }, { status: 400 });
  }

  const body = await req.json().catch(() => ({} as { title?: unknown; description?: unknown }));
  const requestedTitle = typeof body.title === "string" ? body.title.trim() : "";
  const requestedDescription = typeof body.description === "string" ? body.description.trim() : "";
  if (!requestedTitle) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  try {
    const ig = await uploadVideoToInstagram(
      userId,
      video.videoUrl,
      requestedTitle,
      requestedDescription
    );

    await prisma.video.update({
      where: { id: params.videoId },
      data: {
        title: requestedTitle,
        instagramMediaId: ig.mediaId,
        instagramUrl: ig.permalink || null,
      },
    });

    return NextResponse.json({ instagramUrl: ig.permalink, instagramMediaId: ig.mediaId });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Instagram publish failed" },
      { status: 500 }
    );
  }
}

