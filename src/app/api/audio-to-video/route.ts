import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { audioToVideo } from "@/lib/ffmpeg";
import { uploadVideoToYoutube, getNextYoutubePublishSlot } from "@/lib/youtube";
import * as fs from "fs";
import * as path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";

export const maxDuration = 300;

const BASE_PATH = path.resolve(process.env.LOCAL_STORAGE_PATH || "./storage");

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

  const audioFile = formData.get("audio") as File | null;
  const logoFile = formData.get("logo") as File | null;
  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || "";
  const seriesId = (formData.get("seriesId") as string)?.trim();
  const videoFormat = (formData.get("videoFormat") as string) || "landscape";
  const publishToYoutube = formData.get("publishToYoutube") === "1";

  if (!audioFile || audioFile.size === 0)
    return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
  if (!title)
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  if (logoFile && logoFile.size > 0 && !logoFile.type.startsWith("image/")) {
    return NextResponse.json({ error: "Logo must be an image file" }, { status: 400 });
  }

  const ext = audioFile.name.split(".").pop()?.toLowerCase() || "mp3";

  // Resolve series
  let series;
  if (seriesId) series = await prisma.series.findFirst({ where: { id: seriesId, userId } });
  if (!series) {
    series = await prisma.series.findFirst({ where: { userId, title: "Audio Uploads" } });
    if (!series) {
      series = await prisma.series.create({
        data: { userId, title: "Audio Uploads", niche: "Audio to video uploads", videoFormat, status: "ACTIVE" },
      });
    }
  }

  // Create video + job records
  const video = await prisma.video.create({
    data: { seriesId: series.id, title, status: "GENERATING" },
  });

  const job = await prisma.generationJob.create({
    data: {
      videoId: video.id,
      currentStep: "ASSEMBLE",
      stepMessage: "Starting conversion...",
      overallProgress: 0,
    },
  });

  // Save audio to disk
  const videoDir = path.join(BASE_PATH, video.id);
  await fs.promises.mkdir(videoDir, { recursive: true });
  const audioFilename = `audio.${ext}`;
  const audioPath = path.join(videoDir, audioFilename);
  await pipeline(Readable.fromWeb(audioFile.stream() as any), fs.createWriteStream(audioPath));
  const audioApiPath = `/api/files/${video.id}/${audioFilename}`;

  // Optional per-job uploaded logo
  let uploadedLogoApiPath: string | undefined;
  if (logoFile && logoFile.size > 0) {
    const logoExt = (logoFile.name.split(".").pop() || "png").toLowerCase();
    const logoFilename = `logo.${logoExt}`;
    const logoPath = path.join(videoDir, logoFilename);
    await pipeline(Readable.fromWeb(logoFile.stream() as any), fs.createWriteStream(logoPath));
    uploadedLogoApiPath = `/api/files/${video.id}/${logoFilename}`;
  }

  // Run conversion in background (don't await)
  (async () => {
    try {
      const logoApiPath = uploadedLogoApiPath ?? series!.logoUrl ?? undefined;

      const videoApiPath = await audioToVideo(
        video.id,
        audioApiPath,
        videoFormat,
        logoApiPath,
        undefined,
        async (percent) => {
          await prisma.generationJob.update({
            where: { id: job.id },
            data: {
              overallProgress: percent,
              stepMessage: percent < 100 ? `Converting... ${percent}%` : "Conversion complete",
            },
          }).catch(() => {});
        }
      );

      await prisma.video.update({
        where: { id: video.id },
        data: { videoUrl: videoApiPath, status: "READY" },
      });

      await prisma.generationJob.update({
        where: { id: job.id },
        data: { overallProgress: 100, currentStep: "COMPLETE", stepMessage: "Done" },
      });

      if (publishToYoutube) {
        await prisma.video.update({ where: { id: video.id }, data: { status: "PUBLISHING" } });
        try {
          const publishAt = await getNextYoutubePublishSlot(userId);
          const yt = await uploadVideoToYoutube(userId, videoApiPath, title, description, [], publishAt);
          await prisma.video.update({
            where: { id: video.id },
            data: { youtubeVideoId: yt.videoId, youtubeUrl: yt.url, youtubePublishAt: publishAt, status: "PUBLISHED", publishedAt: new Date() },
          });
          await prisma.generationJob.update({
            where: { id: job.id },
            data: { stepMessage: "Published to YouTube!" },
          });
        } catch {
          await prisma.video.update({ where: { id: video.id }, data: { status: "READY" } });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Conversion failed";
      await prisma.video.update({ where: { id: video.id }, data: { status: "FAILED", errorMessage: msg } }).catch(() => {});
      await prisma.generationJob.update({
        where: { id: job.id },
        data: { currentStep: "FAILED", stepMessage: msg, failedStep: "ASSEMBLE" },
      }).catch(() => {});
    }
  })();

  // Return immediately — client polls job progress
  return NextResponse.json({ videoId: video.id, jobId: job.id });
}
