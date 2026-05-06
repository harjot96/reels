import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAudioDuration } from "@/lib/ffmpeg";
import * as fs from "fs";
import * as path from "path";

export const maxDuration = 300;

const BASE_PATH = path.resolve(process.env.LOCAL_STORAGE_PATH || "./storage");

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

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Failed to parse upload" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!file.type.startsWith("video/")) {
    return NextResponse.json({ error: "File must be a video" }, { status: 400 });
  }

  const videoDir = path.join(BASE_PATH, params.videoId);
  await fs.promises.mkdir(videoDir, { recursive: true });

  const ext = file.name.split(".").pop() || "mp4";
  const filename = `video_replaced.${ext}`;
  const filePath = path.join(videoDir, filename);
  const apiPath = `/api/files/${params.videoId}/${filename}`;

  const bytes = await file.arrayBuffer();
  await fs.promises.writeFile(filePath, Buffer.from(bytes));

  let durationSeconds: number | undefined;
  try {
    durationSeconds = Math.round(await getAudioDuration(apiPath));
  } catch { /* non-fatal */ }

  const updated = await prisma.video.update({
    where: { id: params.videoId },
    data: {
      videoUrl: apiPath,
      durationSeconds: durationSeconds ?? video.durationSeconds ?? undefined,
      status: "READY",
      youtubeVideoId: null,
      youtubeUrl: null,
      publishedAt: null,
    },
  });

  return NextResponse.json({ success: true, videoUrl: updated.videoUrl, durationSeconds: updated.durationSeconds });
}
