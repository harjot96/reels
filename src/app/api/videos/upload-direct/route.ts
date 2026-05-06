import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAudioDuration } from "@/lib/ffmpeg";
import * as fs from "fs";
import * as path from "path";

export const maxDuration = 300;

const BASE_PATH = path.resolve(process.env.LOCAL_STORAGE_PATH || "./storage");

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  if (!userId) return NextResponse.json({ error: "User ID missing from session" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (e) {
    return NextResponse.json({ error: "Failed to parse upload" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const title = (formData.get("title") as string | null)?.trim();
  const videoFormat = (formData.get("videoFormat") as string | null) || "landscape";

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
  if (!file.type.startsWith("video/")) {
    return NextResponse.json({ error: "File must be a video" }, { status: 400 });
  }

  try {
    // Find or create a hidden "Direct Uploads" series for this user
    let series = await prisma.series.findFirst({
      where: { userId, title: "Direct Uploads", status: "ACTIVE" },
    });

    if (!series) {
      series = await prisma.series.create({
        data: {
          userId,
          title: "Direct Uploads",
          niche: "Direct video uploads",
          videoFormat,
          status: "ACTIVE",
        },
      });
    } else if (series.videoFormat !== videoFormat) {
      // If the user uploads a different format, update the series format
      // (or just use the existing — keeping it simple here)
    }

    // Create video record
    const video = await prisma.video.create({
      data: { seriesId: series.id, title, status: "GENERATING" },
    });

    // Save file to storage
    const videoDir = path.join(BASE_PATH, video.id);
    await fs.promises.mkdir(videoDir, { recursive: true });

    const ext = file.name.split(".").pop() || "mp4";
    const filename = `video.${ext}`;
    const filePath = path.join(videoDir, filename);
    const apiPath = `/api/files/${video.id}/${filename}`;

    const bytes = await file.arrayBuffer();
    await fs.promises.writeFile(filePath, Buffer.from(bytes));

    // Get duration
    let durationSeconds: number | undefined;
    try {
      durationSeconds = Math.round(await getAudioDuration(apiPath));
    } catch { /* non-fatal */ }

    // Mark as READY
    const updated = await prisma.video.update({
      where: { id: video.id },
      data: { videoUrl: apiPath, durationSeconds, status: "READY" },
    });

    return NextResponse.json({ videoId: updated.id, seriesId: series.id });
  } catch (err: any) {
    console.error("[upload-direct] error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Upload failed" },
      { status: 500 }
    );
  }
}
