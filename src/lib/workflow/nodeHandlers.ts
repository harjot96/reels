import { prisma } from "@/lib/prisma";
import { uploadVideoToYoutube, getNextYoutubePublishSlot } from "@/lib/youtube";
import { uploadVideoToInstagram } from "@/lib/instagram";
import { uploadVideoToFacebook } from "@/lib/facebook";
import { uploadVideoToSnapchat } from "@/lib/snapchat";
import { audioToVideo, getAudioDuration } from "@/lib/ffmpeg";
import { createShortsForVideo } from "@/lib/shorts";
import { runPipeline } from "@/lib/pipeline";
import type { NodeConfig, NodeOutput, ExecutionContext } from "./types";
import * as fs from "fs";
import * as path from "path";

const LOCAL_STORAGE_BASE = path.resolve(process.env.LOCAL_STORAGE_PATH || "./storage");

function resolveVideoId(
  config: { videoIdSource: "upstream" | "fixed"; videoId?: string },
  context: ExecutionContext
): string | null {
  if (config.videoIdSource === "fixed" && config.videoId) return config.videoId;
  const upstream = Object.values(context.outputs).find((o) => o.data?.videoId);
  return (upstream?.data?.videoId as string) ?? null;
}

const DEFAULT_VIDEO_READY_POLL_MS = 2000;

function getVideoReadyPollMs(): number {
  const parsed = Number(process.env.WORKFLOW_VIDEO_READY_POLL_MS ?? DEFAULT_VIDEO_READY_POLL_MS);
  if (!Number.isFinite(parsed) || parsed < 500) return DEFAULT_VIDEO_READY_POLL_MS;
  return Math.min(10000, Math.floor(parsed));
}

async function waitForVideoReady(
  videoId: string,
  timeoutMs = 30 * 60 * 1000,
  notify?: NotifyFn
): Promise<void> {
  const start = Date.now();
  const pollMs = getVideoReadyPollMs();
  let lastNotifyAt = 0;
  while (Date.now() - start < timeoutMs) {
    const video = await prisma.video.findUnique({ where: { id: videoId } });
    if (!video) throw new Error(`Video ${videoId} not found`);
    if (video.status === "READY" || video.status === "PUBLISHED") return;
    if (video.status === "FAILED") throw new Error(`Video generation failed: ${video.errorMessage}`);
    const elapsed = Math.round((Date.now() - start) / 1000);
    // Notify every ~10 seconds so logs stay fresh
    if (notify && Date.now() - lastNotifyAt >= 10_000) {
      notify(`Waiting for video to be ready… ${elapsed}s elapsed (status: ${video.status})`);
      lastNotifyAt = Date.now();
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
  throw new Error("Timed out waiting for video to be ready");
}

async function findUploadedLogoApiPath(videoId: string): Promise<string | undefined> {
  const dir = path.join(LOCAL_STORAGE_BASE, videoId);
  let entries: string[];
  try {
    entries = await fs.promises.readdir(dir);
  } catch {
    return undefined;
  }

  const logoFile = entries.find((f) => /^logo\.[a-z0-9]+$/i.test(f));
  return logoFile ? `/api/files/${videoId}/${logoFile}` : undefined;
}

// notify may be sync or async — callers should not rely on it being awaited
type NotifyFn = (msg: string) => void | Promise<void>;

export async function handleNode(
  nodeId: string,
  config: NodeConfig,
  context: ExecutionContext,
  notify?: NotifyFn
): Promise<NodeOutput> {
  switch (config.type) {
    case "trigger_manual":
    case "trigger_schedule":
      return { success: true, data: { triggered: true } };

    case "action_upload_video": {
      if (!config.videoId) throw new Error("No video uploaded yet. Open the node config and upload a file first.");
      let video = await prisma.video.findUnique({
        where: { id: config.videoId },
        include: { series: { select: { videoFormat: true, logoUrl: true } } },
      });
      if (!video) throw new Error(`Uploaded video ${config.videoId} not found`);
      if (video.status === "FAILED") throw new Error(video.errorMessage || "Uploaded media processing failed");

      // If the video is already ready, skip all conversion logic
      if (video.status !== "READY" && video.status !== "PUBLISHED") {
        // Recovery path: upload background task may still be running OR got interrupted.
        // Wait up to 60s for the background task to finish first.
        if (video.audioUrl && !video.videoUrl && video.status === "GENERATING") {
          notify?.("MP3 → video conversion in progress… waiting up to 60s for background task");
          await waitForVideoReady(config.videoId, 60_000, notify);
          video = await prisma.video.findUnique({
            where: { id: config.videoId },
            include: { series: { select: { videoFormat: true, logoUrl: true } } },
          });
        }

        // If still not ready after waiting, run conversion ourselves with live progress
        if (video && !video.videoUrl && video.audioUrl) {
          notify?.("Converting MP3 to video (this may take a few minutes)…");
          try {
            const uploadedLogo = await findUploadedLogoApiPath(config.videoId);
            const logoApiPath = uploadedLogo ?? video.series.logoUrl ?? undefined;

            let lastPct = -1;
            const renderedVideo = await audioToVideo(
              video.id,
              video.audioUrl,
              video.series.videoFormat || "landscape",
              logoApiPath,
              undefined,
              (pct: number) => {
                const rounded = Math.round(pct / 5) * 5; // snap to 5% steps
                if (rounded !== lastPct) {
                  lastPct = rounded;
                  notify?.(`Converting MP3 to video… ${rounded}%`);
                }
              }
            );

            let durationSeconds: number | undefined;
            try { durationSeconds = Math.round(await getAudioDuration(video.audioUrl)); } catch { /* non-fatal */ }

            await prisma.video.update({
              where: { id: video.id },
              data: { videoUrl: renderedVideo, durationSeconds, status: "READY" },
            });
            notify?.("MP3 conversion complete ✓");

            video = await prisma.video.findUnique({
              where: { id: config.videoId },
              include: { series: { select: { videoFormat: true, logoUrl: true } } },
            });
          } catch (err) {
            const msg = err instanceof Error ? err.message : "MP3 conversion failed";
            await prisma.video.update({
              where: { id: config.videoId },
              data: { status: "FAILED", errorMessage: msg },
            }).catch(() => {});
            throw new Error(msg);
          }
        }

        // Final fallback: still not ready — wait with polling
        if (!video?.videoUrl || (video.status !== "READY" && video.status !== "PUBLISHED")) {
          notify?.("Waiting for media to become ready…");
          await waitForVideoReady(config.videoId, 30 * 60 * 1000, notify);
          video = await prisma.video.findUnique({
            where: { id: config.videoId },
            include: { series: { select: { videoFormat: true, logoUrl: true } } },
          });
        }
      }

      if (!video?.videoUrl) {
        throw new Error("Uploaded media is not ready yet. Re-upload and try again.");
      }

      return { success: true, data: { videoId: config.videoId, videoUrl: video.videoUrl, title: video.title } };
    }

    case "action_generate_video": {
      if (!config.seriesId) throw new Error("seriesId is required");
      const series = await prisma.series.findUnique({ where: { id: config.seriesId } });
      if (!series) throw new Error(`Series ${config.seriesId} not found`);

      const video = await prisma.video.create({
        data: {
          seriesId: config.seriesId,
          title: `${series.title} – Auto`,
          status: "PENDING",
        },
      });

      // Create the generation job record expected by runPipeline
      await prisma.generationJob.create({
        data: { videoId: video.id, currentStep: "SCRIPT", overallProgress: 0 },
      });

      notify?.("Starting video generation pipeline…");
      // Run pipeline directly — no HTTP hop needed
      await runPipeline(video.id);

      const ready = await prisma.video.findUnique({ where: { id: video.id } });
      if (ready?.status === "FAILED") throw new Error(ready.errorMessage || "Video generation failed");
      return {
        success: true,
        data: {
          videoId: video.id,
          videoUrl: ready?.videoUrl ?? "",
          title: ready?.title ?? "",
        },
      };
    }

    case "action_create_shorts": {
      const videoId = resolveVideoId(config, context);
      if (!videoId) throw new Error("No videoId available for Create Shorts");

      const shorts = await createShortsForVideo(videoId, context.userId, notify, config.shortDuration);
      return { success: true, data: { videoId, shortsCount: shorts.length } };
    }

    case "action_publish_youtube": {
      const videoId = resolveVideoId(config, context);
      if (!videoId) throw new Error("No videoId available for Publish YouTube");

      const video = await prisma.video.findUnique({ where: { id: videoId } });
      if (!video?.videoUrl) throw new Error("Video has no URL");

      const tagList = config.tags
        ? config.tags.split(",").map((t) => t.trim()).filter(Boolean)
        : [];
      const publishAt = await getNextYoutubePublishSlot(context.userId);
      const result = await uploadVideoToYoutube(
        context.userId,
        video.videoUrl,
        video.title,
        "",
        tagList,
        publishAt
      );
      await prisma.video.update({
        where: { id: videoId },
        data: { youtubeVideoId: result.videoId, youtubeUrl: result.url, youtubePublishAt: publishAt, status: "PUBLISHED" },
      });
      return { success: true, data: { videoId, youtubeUrl: result.url } };
    }

    case "action_publish_instagram": {
      const videoId = resolveVideoId(config, context);
      if (!videoId) throw new Error("No videoId available for Publish Instagram");

      const video = await prisma.video.findUnique({ where: { id: videoId } });
      if (!video?.videoUrl) throw new Error("Video has no URL");

      const title = config.title || video.title;
      const hashtagSuffix = config.tags
        ? "\n" + config.tags.split(",").map((t) => "#" + t.trim()).filter(Boolean).join(" ")
        : "";
      const igDescription = (config.description ?? "") + hashtagSuffix;
      const result = await uploadVideoToInstagram(context.userId, video.videoUrl, title, igDescription);
      await prisma.video.update({
        where: { id: videoId },
        data: { instagramMediaId: result.mediaId, instagramUrl: result.permalink },
      });
      return { success: true, data: { videoId, instagramUrl: result.permalink } };
    }

    case "action_publish_facebook": {
      const videoId = resolveVideoId(config, context);
      if (!videoId) throw new Error("No videoId available for Publish Facebook");

      const video = await prisma.video.findUnique({ where: { id: videoId } });
      if (!video?.videoUrl) throw new Error("Video has no URL");

      const title = config.title || video.title;
      const fbHashtagSuffix = config.tags
        ? "\n" + config.tags.split(",").map((t) => "#" + t.trim()).filter(Boolean).join(" ")
        : "";
      const fbDescription = (config.description ?? "") + fbHashtagSuffix;
      const result = await uploadVideoToFacebook(context.userId, video.videoUrl, title, fbDescription);
      await prisma.video.update({
        where: { id: videoId },
        data: { facebookPostId: result.postId, facebookUrl: result.permalink },
      });
      return { success: true, data: { videoId, facebookUrl: result.permalink } };
    }

    case "action_publish_snapchat": {
      const videoId = resolveVideoId(config, context);
      if (!videoId) throw new Error("No videoId available for Publish Snapchat");

      const video = await prisma.video.findUnique({ where: { id: videoId } });
      if (!video?.videoUrl) throw new Error("Video has no URL");

      const title = config.title || video.title;
      const snapHashtagSuffix = config.tags
        ? "\n" + config.tags.split(",").map((t) => "#" + t.trim()).filter(Boolean).join(" ")
        : "";
      const snapDescription = (config.description ?? "") + snapHashtagSuffix;
      const result = await uploadVideoToSnapchat(context.userId, video.videoUrl, title, snapDescription);
      await prisma.video.update({
        where: { id: videoId },
        data: { snapchatPostId: result.postId, snapchatUrl: result.shareUrl },
      });
      return { success: true, data: { videoId, snapchatUrl: result.shareUrl } };
    }

    case "condition_if_else": {
      const upstream = Object.values(context.outputs).find((o) => o.data);
      const fieldValue = String((upstream?.data ?? {})[config.field] ?? "");
      let result = false;
      if (config.operator === "eq") result = fieldValue === config.value;
      else if (config.operator === "neq") result = fieldValue !== config.value;
      else if (config.operator === "contains") result = fieldValue.includes(config.value);
      return { success: true, branch: result ? "true" : "false", data: { result } };
    }

    case "delay": {
      const multiplier = config.unit === "hours" ? 3600000 : config.unit === "minutes" ? 60000 : 1000;
      await new Promise((r) => setTimeout(r, config.amount * multiplier));
      return { success: true, data: { delayed: config.amount, unit: config.unit } };
    }

    default:
      throw new Error(`Unknown node type`);
  }
}
