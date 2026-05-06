import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAbsolutePath } from "@/lib/storage";

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = (session.user as { id: string }).id;

    const streams = await prisma.liveStream.findMany({
      where: { userId },
      orderBy: { startedAt: "desc" },
      take: 20,
    });
    return NextResponse.json(streams);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = (session.user as { id: string }).id;

    const body = await req.json() as {
      videoId: string;
      title: string;
      description?: string;
      platforms: ("youtube" | "facebook")[];
    };
    const { videoId, title, description, platforms } = body;

    if (!videoId || !title || !platforms?.length) {
      return NextResponse.json({ error: "videoId, title, and platforms are required" }, { status: 400 });
    }

    // Resolve video file path
    const video = await prisma.video.findUnique({ where: { id: videoId } });
    if (!video?.videoUrl) {
      return NextResponse.json({ error: "Video not found or not ready" }, { status: 404 });
    }

    const videoPath = getAbsolutePath(video.videoUrl.split("?")[0]);

    // Create stream record
    const stream = await prisma.liveStream.create({
      data: {
        userId,
        videoId,
        title: title.trim().slice(0, 100),
        description: (description ?? "").trim().slice(0, 5000),
        platforms: JSON.stringify(platforms),
        status: "STARTING",
      },
    });

    // Dynamic import keeps child_process/googleapis out of the webpack bundle
    // and ensures any load-time error surfaces here instead of crashing the module.
    const { startLiveStream } = await import("@/lib/livestream");

    // Fire-and-forget — client polls for status
    startLiveStream(stream.id, userId, videoPath, platforms).catch((err) => {
      console.error("[livestream] start failed:", err);
    });

    return NextResponse.json({ streamId: stream.id, status: "STARTING" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[POST /api/livestream]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
