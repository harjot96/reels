import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { convertVideoFormat, getAudioDuration } from "@/lib/ffmpeg";

export const maxDuration = 300;

export async function POST(
  req: NextRequest,
  { params }: { params: { videoId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const video = await prisma.video.findFirst({
    where: { id: params.videoId, series: { userId: session.user.id } },
  });
  if (!video) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!video.videoUrl) return NextResponse.json({ error: "No video file to convert" }, { status: 400 });

  const { targetFormat } = await req.json();
  if (!["landscape", "shorts", "square"].includes(targetFormat)) {
    return NextResponse.json({ error: "Invalid format" }, { status: 400 });
  }

  const newVideoUrl = await convertVideoFormat(params.videoId, video.videoUrl, targetFormat);

  let durationSeconds = video.durationSeconds ?? undefined;
  try {
    durationSeconds = Math.round(await getAudioDuration(newVideoUrl));
  } catch { /* keep existing */ }

  await prisma.video.update({
    where: { id: params.videoId },
    data: {
      videoUrl: newVideoUrl,
      durationSeconds,
      status: "READY",
      youtubeVideoId: null,
      youtubeUrl: null,
      publishedAt: null,
    },
  });

  return NextResponse.json({ success: true, videoUrl: newVideoUrl });
}
