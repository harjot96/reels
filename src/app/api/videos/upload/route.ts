import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { audioToVideo, getAudioDuration } from "@/lib/ffmpeg";
import * as fs from "fs";
import * as path from "path";
import { pipeline } from "stream/promises";
import { Readable } from "stream";

/** Stream a Web ReadableStream / File directly to disk without buffering in memory */
async function streamToDisk(source: File, destPath: string): Promise<void> {
  const nodeReadable = Readable.fromWeb(source.stream() as import("stream/web").ReadableStream);
  const writeStream = fs.createWriteStream(destPath);
  await pipeline(nodeReadable, writeStream);
}

// Allow up to 2 GB uploads and 5-min timeout
export const maxDuration = 300;

const BASE_PATH = path.resolve(process.env.LOCAL_STORAGE_PATH || "./storage");
const AUDIO_EXTS = new Set(["mp3", "wav", "ogg", "flac", "m4a", "aac"]);
const VIDEO_EXTS = new Set(["mp4", "mov", "mkv", "avi", "webm", "m4v", "mpeg", "mpg"]);
const VALID_VIDEO_FORMATS = new Set(["landscape", "shorts", "square"]);

function getSafeExt(fileName: string, fallback: string): string {
  const raw = (fileName.split(".").pop() || fallback).toLowerCase();
  const safe = raw.replace(/[^a-z0-9]/g, "");
  return safe || fallback;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Failed to parse upload" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const logoFile = formData.get("logo") as File | null;
  const title = (formData.get("title") as string | null)?.trim();
  const seriesId = formData.get("seriesId") as string | null;
  const requestedFormat = (formData.get("videoFormat") as string | null)?.trim();

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
  if (!seriesId) return NextResponse.json({ error: "Series is required" }, { status: 400 });

  // Verify series belongs to user
  const series = await prisma.series.findFirst({
    where: { id: seriesId, userId },
  });
  if (!series) return NextResponse.json({ error: "Series not found" }, { status: 404 });

  const ext = getSafeExt(file.name, "mp4");
  const isAudioUpload = file.type.startsWith("audio/") || AUDIO_EXTS.has(ext);
  const isVideoUpload = file.type.startsWith("video/") || VIDEO_EXTS.has(ext);
  if (!isAudioUpload && !isVideoUpload) {
    return NextResponse.json({ error: "File must be a video or MP3/audio file" }, { status: 400 });
  }
  if (logoFile && logoFile.size > 0 && !logoFile.type.startsWith("image/")) {
    return NextResponse.json({ error: "Logo must be an image file" }, { status: 400 });
  }
  if (isAudioUpload && !logoFile?.size && !series.logoUrl) {
    return NextResponse.json(
      { error: "MP3 conversion needs a logo. Upload one or set a series logo first." },
      { status: 400 }
    );
  }

  // Create video record first to get ID
  const video = await prisma.video.create({
    data: {
      seriesId,
      title,
      status: "GENERATING",
    },
  });

  // Save file to storage
  const videoDir = path.join(BASE_PATH, video.id);
  await fs.promises.mkdir(videoDir, { recursive: true });

  try {
    if (isVideoUpload) {
      const filename = `video.${ext}`;
      const filePath = path.join(videoDir, filename);
      const apiPath = `/api/files/${video.id}/${filename}`;

      await streamToDisk(file, filePath);

      // Get duration via ffprobe
      let durationSeconds: number | undefined;
      try {
        durationSeconds = Math.round(await getAudioDuration(apiPath));
      } catch { /* non-fatal */ }

      const updated = await prisma.video.update({
        where: { id: video.id },
        data: {
          videoUrl: apiPath,
          durationSeconds,
          status: "READY",
        },
      });

      return NextResponse.json({ videoId: updated.id, mediaKind: "video" });
    }

    const audioExt = getSafeExt(file.name, "mp3");
    const audioFilename = `audio.${audioExt}`;
    const audioFilePath = path.join(videoDir, audioFilename);
    const audioApiPath = `/api/files/${video.id}/${audioFilename}`;
    await streamToDisk(file, audioFilePath);

    let logoApiPath: string | undefined = series.logoUrl ?? undefined;
    if (logoFile && logoFile.size > 0) {
      const logoExt = getSafeExt(logoFile.name, "png");
      const logoFilename = `logo.${logoExt}`;
      const logoFilePath = path.join(videoDir, logoFilename);
      await streamToDisk(logoFile, logoFilePath);
      logoApiPath = `/api/files/${video.id}/${logoFilename}`;
    }

    const targetFormat = VALID_VIDEO_FORMATS.has(requestedFormat ?? "")
      ? (requestedFormat as string)
      : VALID_VIDEO_FORMATS.has(series.videoFormat)
        ? series.videoFormat
        : "landscape";

    await prisma.video.update({
      where: { id: video.id },
      data: { audioUrl: audioApiPath, status: "GENERATING" },
    });

    // MP3->video conversion can take minutes; run it in background
    // so workflow node gets a videoId immediately.
    void (async () => {
      try {
        const videoApiPath = await audioToVideo(video.id, audioApiPath, targetFormat, logoApiPath);

        let durationSeconds: number | undefined;
        try {
          durationSeconds = Math.round(await getAudioDuration(audioApiPath));
        } catch {
          // non-fatal
        }

        await prisma.video.update({
          where: { id: video.id },
          data: {
            audioUrl: audioApiPath,
            videoUrl: videoApiPath,
            durationSeconds,
            status: "READY",
          },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "MP3 conversion failed";
        await prisma.video.update({
          where: { id: video.id },
          data: { status: "FAILED", errorMessage: msg },
        }).catch(() => {});
      }
    })();

    return NextResponse.json({ videoId: video.id, mediaKind: "audio", processing: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upload failed";
    await prisma.video.update({
      where: { id: video.id },
      data: { status: "FAILED", errorMessage: msg },
    }).catch(() => {});
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
