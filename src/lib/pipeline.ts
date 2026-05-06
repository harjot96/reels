import { prisma } from "./prisma";
import { generateVideoScript } from "./claude";
import { generateAudio } from "./elevenlabs";
import { generateImage } from "./replicate";
import { searchAndDownloadClip } from "./pexels";
import { generateAIVideoClip, generateCharacterDescription } from "./aivideo";
import { assembleVideo, assembleVideoFromClips, getAudioDuration, mixBackgroundMusic, overlaySegmentTitles, overlayLogo } from "./ffmpeg";
import { generateThumbnail } from "./thumbnail";
import { buildSRT, buildChapters } from "./captions";
import { fetchBackgroundMusic } from "./music";
import { uploadVideoToYoutube, uploadThumbnail, uploadCaptions, getNextYoutubePublishSlot } from "./youtube";
import * as fs from "fs";
import * as path from "path";
import { getAbsolutePath } from "./storage";

// Priority: Replicate AI video > Pexels stock clips > AI images
const USE_AI_VIDEO    = !!(process.env.REPLICATE_API_KEY && !process.env.REPLICATE_API_KEY.startsWith("replace"));
const USE_VIDEO_CLIPS = !USE_AI_VIDEO && !!(process.env.PEXELS_API_KEY && !process.env.PEXELS_API_KEY.startsWith("replace"));
const USE_MUSIC       = !!(process.env.PIXABAY_API_KEY && !process.env.PIXABAY_API_KEY.startsWith("replace"));

// Max concurrent image/clip downloads (avoids hammering APIs while still being fast)
const MEDIA_CONCURRENCY = parseInt(process.env.MEDIA_CONCURRENCY ?? "3", 10);

export type PipelineStep = "SCRIPT" | "AUDIO" | "IMAGES" | "ASSEMBLE" | "UPLOAD" | "COMPLETE" | "FAILED";

async function isCancelled(videoId: string): Promise<boolean> {
  const v = await prisma.video.findUnique({ where: { id: videoId }, select: { status: true } });
  return v?.status === "FAILED";
}

/**
 * Update job progress.
 * Logs are kept in-memory (jobLogs) to avoid a DB read on every call.
 */
async function updateJob(
  jobId: string,
  jobLogs: string[],
  step: PipelineStep,
  progress: number,
  message: string,
  overallProgress: number
) {
  jobLogs.push(`[${new Date().toISOString()}] [${step}] ${message}`);

  await prisma.generationJob.update({
    where: { id: jobId },
    data: {
      currentStep: step,
      stepProgress: progress,
      overallProgress,
      stepMessage: message,
      logs: JSON.stringify(jobLogs),
    },
  });
}

/**
 * Run up to `limit` async tasks in parallel, preserving result order.
 */
async function parallelLimit<T>(
  count: number,
  fn: (index: number) => Promise<T>,
  limit: number
): Promise<T[]> {
  const results = new Array<T>(count);
  let next = 0;
  async function worker() {
    while (next < count) {
      const i = next++;
      results[i] = await fn(i);
    }
  }
  const workers = Array.from({ length: Math.min(limit, count) }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function runPipeline(
  videoId: string,
  durationOverride?: number,
  preResearch?: { research: string; angle: string; contentType?: "story" | "facts" }
) {
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    include: { series: true, job: true },
  });
  if (!video || !video.job) throw new Error("Video or job not found");

  const jobId = video.job.id;
  const series = video.series;
  const videoDuration = durationOverride ?? series.videoDuration;

  // Restore any logs already persisted (e.g. from a prior partial run)
  const jobLogs: string[] = [];
  if (video.job.logs) {
    try { jobLogs.push(...(JSON.parse(video.job.logs) as string[])); } catch { /* ignore */ }
  }

  try {
    await prisma.video.update({ where: { id: videoId }, data: { status: "GENERATING" } });

    // ── Step 1: Script ────────────────────────────────────────────────────────
    let script: Awaited<ReturnType<typeof generateVideoScript>>;
    if (video.script) {
      script = JSON.parse(video.script);
      await updateJob(jobId, jobLogs, "SCRIPT", 100, "Script already confirmed, skipping", 10);
    } else {
      await updateJob(jobId, jobLogs, "SCRIPT", 0, "Generating script with Claude AI...", 0);
      const previousVideos = await prisma.video.findMany({
        where: { seriesId: series.id, title: { not: "" } },
        select: { title: true, script: true },
        orderBy: { createdAt: "desc" },
        take: 30,
      });
      const previousStories = previousVideos
        .map((v) => {
          const title = v.title;
          let firstLine = "";
          try {
            const parsed = JSON.parse(v.script ?? "{}");
            firstLine = parsed.segments?.[0]?.text?.slice(0, 120) ?? "";
          } catch { /* ignore */ }
          return firstLine ? `${title} — ${firstLine}` : title;
        })
        .filter(Boolean);
      script = await generateVideoScript(series.niche, videoDuration, series.style, series.language, previousStories, preResearch);
      await prisma.video.update({
        where: { id: videoId },
        data: { title: script.title, script: JSON.stringify(script) },
      });
      await updateJob(jobId, jobLogs, "SCRIPT", 100, "Script generated", 10);
    }

    if (await isCancelled(videoId)) return;

    // ── Step 2: Audio ────────────────────────────────────────────────────────
    let audioPath: string;
    if (video.audioUrl) {
      audioPath = video.audioUrl;
      await updateJob(jobId, jobLogs, "AUDIO", 100, "Audio already generated, skipping", 30);
    } else {
      await updateJob(jobId, jobLogs, "AUDIO", 0, "Generating voiceover...", 10);
      audioPath = await generateAudio(script.fullText, series.voiceId, videoId, series.language, series.ttsProvider);
      await prisma.video.update({ where: { id: videoId }, data: { audioUrl: audioPath } });
      await updateJob(jobId, jobLogs, "AUDIO", 100, "Audio generated", 30);
    }

    if (await isCancelled(videoId)) return;

    // ── Step 3: Media (clips / images) — parallel ────────────────────────────
    const existingAssets = await prisma.imageAsset.findMany({
      where: { videoId },
      orderBy: { index: "asc" },
    });

    let mediaPaths: string[];
    const segCount = script.segments.length;

    if (existingAssets.length === segCount) {
      mediaPaths = existingAssets.map((a) => a.url);
      await updateJob(jobId, jobLogs, "IMAGES", 100, "Media already generated, skipping", 70);
    } else {
      await prisma.imageAsset.deleteMany({ where: { videoId } });
      let completed = 0;

      if (USE_AI_VIDEO) {
        await updateJob(jobId, jobLogs, "IMAGES", 0, "Designing video character...", 28);
        const characterDesc = await generateCharacterDescription(series.niche, series.style);
        await updateJob(jobId, jobLogs, "IMAGES", 5, `Generating ${segCount} AI video clips (parallel)...`, 30);

        mediaPaths = await parallelLimit(segCount, async (i) => {
          const mediaPath = await generateAIVideoClip(script.segments[i].visualDescription, characterDesc, videoId, i, series.videoFormat);
          await prisma.imageAsset.create({ data: { videoId, prompt: script.segments[i].visualDescription, url: mediaPath, index: i } });
          completed++;
          const pct = Math.round((completed / segCount) * 100);
          void updateJob(jobId, jobLogs, "IMAGES", pct, `AI clip ${completed}/${segCount} done`, 30 + Math.round((pct / 100) * 40));
          return mediaPath;
        }, MEDIA_CONCURRENCY);

      } else if (USE_VIDEO_CLIPS) {
        await updateJob(jobId, jobLogs, "IMAGES", 0, `Fetching ${segCount} stock clips (parallel)...`, 30);

        mediaPaths = await parallelLimit(segCount, async (i) => {
          const mediaPath = await searchAndDownloadClip(script.segments[i].visualDescription, series.videoFormat, videoId, i);
          await prisma.imageAsset.create({ data: { videoId, prompt: script.segments[i].visualDescription, url: mediaPath, index: i } });
          completed++;
          const pct = Math.round((completed / segCount) * 100);
          void updateJob(jobId, jobLogs, "IMAGES", pct, `Clip ${completed}/${segCount} downloaded`, 30 + Math.round((pct / 100) * 40));
          return mediaPath;
        }, MEDIA_CONCURRENCY);

      } else {
        await updateJob(jobId, jobLogs, "IMAGES", 0, `Generating ${segCount} AI images (parallel)...`, 30);

        mediaPaths = await parallelLimit(segCount, async (i) => {
          const mediaPath = await generateImage(script.segments[i].visualDescription, series.imageStyle, videoId, i, series.videoFormat);
          await prisma.imageAsset.create({ data: { videoId, prompt: script.segments[i].visualDescription, url: mediaPath, index: i } });
          completed++;
          const pct = Math.round((completed / segCount) * 100);
          void updateJob(jobId, jobLogs, "IMAGES", pct, `Image ${completed}/${segCount} generated`, 30 + Math.round((pct / 100) * 40));
          return mediaPath;
        }, MEDIA_CONCURRENCY);
      }

      await updateJob(jobId, jobLogs, "IMAGES", 100, `All ${segCount} media files ready`, 70);
    }

    if (await isCancelled(videoId)) return;

    // ── Step 4: Assemble ─────────────────────────────────────────────────────
    await updateJob(jobId, jobLogs, "ASSEMBLE", 0, "Assembling video with FFmpeg...", 70);
    const audioDuration = await getAudioDuration(audioPath);
    let lastAssemblePct = -1;
    let lastAssembleUpdateAt = 0;
    const reportAssembleProgress = (pct: number) => {
      const safe = Math.max(0, Math.min(100, Math.round(pct)));
      const now = Date.now();
      if (safe <= lastAssemblePct) return;
      if (safe - lastAssemblePct < 2 && now - lastAssembleUpdateAt < 900) return;
      lastAssemblePct = safe;
      lastAssembleUpdateAt = now;
      void updateJob(
        jobId,
        jobLogs,
        "ASSEMBLE",
        Math.min(59, safe),
        `Encoding video... ${safe}%`,
        70 + Math.round((safe / 100) * 10)
      );
    };

    // Fetch optional resources in parallel while assemble starts
    const [bgMusicPath] = await Promise.all([
      (async () => {
        if (series.bgMusicUrl) return series.bgMusicUrl;
        if (USE_MUSIC) {
          try { return await fetchBackgroundMusic(series.niche, videoId); } catch { return null; }
        }
        return null;
      })(),
    ]);

    let videoPath = (USE_AI_VIDEO || USE_VIDEO_CLIPS)
      ? await assembleVideoFromClips(videoId, mediaPaths, audioPath, audioDuration, series.videoFormat, reportAssembleProgress)
      : await assembleVideo(videoId, mediaPaths, audioPath, audioDuration, series.videoFormat, reportAssembleProgress);

    // ── 4a: Overlay segment titles ────────────────────────────────────────────
    await updateJob(jobId, jobLogs, "ASSEMBLE", 62, "Overlaying on-screen titles...", 78);
    videoPath = await overlaySegmentTitles(
      videoId,
      videoPath,
      script.segments,
      audioDuration,
      script.overlayTitle
    );

    // ── 4b: Background music ──────────────────────────────────────────────────
    if (bgMusicPath) {
      await updateJob(jobId, jobLogs, "ASSEMBLE", 72, "Mixing background music...", 82);
      try {
        videoPath = await mixBackgroundMusic(videoId, videoPath, bgMusicPath, series.bgMusicVolume ?? 0.12);
        await updateJob(jobId, jobLogs, "ASSEMBLE", 80, "Background music mixed", 85);
      } catch { /* non-fatal */ }
    }

    // ── 4c: Channel logo watermark ────────────────────────────────────────────
    if (series.logoUrl) {
      await updateJob(jobId, jobLogs, "ASSEMBLE", 82, "Adding channel logo...", 86);
      try {
        videoPath = await overlayLogo(videoId, videoPath, series.logoUrl);
      } catch { /* non-fatal */ }
    }

    // ── 4d: Thumbnail + captions (parallel) ───────────────────────────────────
    await updateJob(jobId, jobLogs, "ASSEMBLE", 85, "Generating thumbnail & captions...", 87);
    const srtContent = buildSRT(script.segments, audioDuration);
    const chaptersText = buildChapters(script.segments, audioDuration);

    const [thumbnailUrl, srtUrl] = await Promise.all([
      generateThumbnail(videoId, videoPath, script.title).catch(() => undefined),
      (async () => {
        try {
          const { saveFile } = await import("./storage");
          const srtBuf = Buffer.from(srtContent, "utf-8");
          return await saveFile(srtBuf, videoId, "captions.srt", "text/plain");
        } catch { return undefined; }
      })(),
    ]);

    await prisma.video.update({
      where: { id: videoId },
      data: {
        videoUrl: videoPath,
        thumbnailUrl: thumbnailUrl ?? null,
        srtUrl: srtUrl ?? null,
        chapters: chaptersText || null,
        durationSeconds: Math.round(audioDuration),
        status: "READY",
      },
    });
    await updateJob(jobId, jobLogs, "ASSEMBLE", 100, "Video assembled", 90);

    // ── Step 5: Upload to YouTube ─────────────────────────────────────────────
    if (series.autoPublish) {
      await updateJob(jobId, jobLogs, "UPLOAD", 0, "Uploading to YouTube...", 90);
      await prisma.video.update({ where: { id: videoId }, data: { status: "PUBLISHING" } });

      const hashtagStr = (script.hashtags ?? []).join(" ");
      const baseParts = [script.description?.trim(), chaptersText, hashtagStr].filter(Boolean);
      const descriptionWithChapters = baseParts.join("\n\n");

      const publishAt = await getNextYoutubePublishSlot(series.userId);
      const ytResult = await uploadVideoToYoutube(
        series.userId, videoPath, script.title, descriptionWithChapters, script.tags, publishAt
      );

      await updateJob(jobId, jobLogs, "UPLOAD", 40, "Video uploaded, adding thumbnail & captions...", 95);

      await Promise.all([
        thumbnailUrl
          ? uploadThumbnail(series.userId, ytResult.videoId, thumbnailUrl).catch(() => {})
          : Promise.resolve(),
        uploadCaptions(series.userId, ytResult.videoId, srtContent, series.language).catch(() => {}),
      ]);

      await prisma.video.update({
        where: { id: videoId },
        data: { status: "PUBLISHED", youtubeVideoId: ytResult.videoId, youtubeUrl: ytResult.url, youtubePublishAt: publishAt, publishedAt: new Date() },
      });
      await updateJob(jobId, jobLogs, "COMPLETE", 100, "Published to YouTube!", 100);
    } else {
      await updateJob(jobId, jobLogs, "COMPLETE", 100, "Video ready for review", 100);
    }

    await prisma.generationJob.update({
      where: { id: jobId },
      data: { currentStep: "COMPLETE", overallProgress: 100 },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    const currentJob = await prisma.generationJob.findUnique({ where: { id: jobId } });
    const failedStep = currentJob?.currentStep as PipelineStep;

    await prisma.generationJob.update({
      where: { id: jobId },
      data: { currentStep: "FAILED", failedStep, stepMessage: errMsg },
    });
    await prisma.video.update({
      where: { id: videoId },
      data: { status: "FAILED", errorMessage: errMsg },
    });
  }
}
