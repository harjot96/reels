import { spawn, type ChildProcess } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { google } from "googleapis";
import { prisma } from "./prisma";
import { getAuthClientForUser } from "./youtube";
import { decrypt } from "./youtube";
import { getAbsolutePath } from "./storage";

// ── In-memory map of running FFmpeg processes (PID → ChildProcess)
// Survives within the same Node.js process lifetime.
const runningProcesses = new Map<number, ChildProcess>();

// ─── YouTube Live ─────────────────────────────────────────────────────────────

export async function createYoutubeLiveBroadcast(
  userId: string,
  title: string,
  description: string
): Promise<{ broadcastId: string; streamId: string; rtmpUrl: string; streamKey: string; watchUrl: string }> {
  const auth = await getAuthClientForUser(userId);
  const youtube = google.youtube({ version: "v3", auth });

  // Schedule 2 minutes ahead — "now" timestamps are often rejected
  const scheduledStartTime = new Date(Date.now() + 2 * 60 * 1000).toISOString();

  // 1. Create broadcast (minimal required fields only — advanced options vary by account)
  const broadcastRes = await youtube.liveBroadcasts.insert({
    part: ["snippet", "status", "contentDetails"],
    requestBody: {
      snippet: {
        title: title.slice(0, 100),
        description: description.slice(0, 5000),
        scheduledStartTime,
      },
      status: {
        privacyStatus: "public",
        selfDeclaredMadeForKids: false,
      },
      contentDetails: {
        enableAutoStart: true,
        recordFromStart: true,
        monitorStream: { enableMonitorStream: false },
      },
    },
  });

  const broadcastId = broadcastRes.data.id;
  if (!broadcastId) throw new Error("YouTube did not return a broadcast ID");
  const watchUrl = `https://www.youtube.com/watch?v=${broadcastId}`;

  // 2. Create RTMP ingest stream
  const streamRes = await youtube.liveStreams.insert({
    part: ["snippet", "cdn", "status"],
    requestBody: {
      snippet: { title: title.slice(0, 100) },
      cdn: {
        ingestionType: "rtmp",
        resolution: "variable",
        frameRate: "variable",
      },
    },
  });

  const streamId = streamRes.data.id;
  if (!streamId) throw new Error("YouTube did not return a stream ID");

  const ingestion = streamRes.data.cdn?.ingestionInfo;
  const rtmpUrl = (ingestion?.ingestionAddress ?? "").replace(/\/$/, ""); // strip trailing slash
  const streamKey = ingestion?.streamName ?? "";

  if (!rtmpUrl || !streamKey) {
    throw new Error(
      "YouTube did not return an RTMP URL or stream key. " +
      "Make sure Live Streaming is enabled on your channel: YouTube Studio → Settings → Channel → Feature eligibility."
    );
  }

  // 3. Bind broadcast ↔ stream
  await youtube.liveBroadcasts.bind({
    id: broadcastId,
    part: ["id", "contentDetails"],
    streamId,
  });

  return { broadcastId, streamId, rtmpUrl, streamKey, watchUrl };
}

export async function transitionYoutubeBroadcast(
  userId: string,
  broadcastId: string,
  broadcastStatus: "testing" | "live" | "complete"
): Promise<void> {
  const auth = await getAuthClientForUser(userId);
  const youtube = google.youtube({ version: "v3", auth });
  await youtube.liveBroadcasts.transition({
    broadcastStatus,
    id: broadcastId,
    part: ["id", "status"],
  });
}

export async function endYoutubeLiveBroadcast(userId: string, broadcastId: string): Promise<void> {
  try {
    await transitionYoutubeBroadcast(userId, broadcastId, "complete");
  } catch {
    // already ended or not started — non-fatal
  }
}

// ─── Facebook Live ────────────────────────────────────────────────────────────

async function getFacebookPageToken(userId: string): Promise<{ pageId: string; pageToken: string }> {
  const account = await prisma.facebookAccount.findUnique({ where: { userId } });
  if (!account) throw new Error("Facebook account not connected");
  return {
    pageId: account.pageId,
    pageToken: decrypt(account.pageAccessToken),
  };
}

const GRAPH_VERSION = process.env.FACEBOOK_GRAPH_VERSION || "v22.0";

export async function createFacebookLiveVideo(
  userId: string,
  title: string,
  description: string
): Promise<{ videoId: string; streamUrl: string; permalink: string }> {
  const { pageId, pageToken } = await getFacebookPageToken(userId);

  const body = new URLSearchParams({
    status: "LIVE_NOW",
    title: title.slice(0, 255),
    description: description.slice(0, 5000),
    access_token: pageToken,
  });

  // Live Videos API uses graph.facebook.com (NOT graph-video which is for file uploads)
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/live_videos`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  // Safely parse response — Facebook may return empty body on some errors
  const text = await res.text().catch(() => "");
  let json: any = {};
  try { json = text ? JSON.parse(text) : {}; } catch { /* non-JSON error page */ }

  if (!res.ok) {
    throw new Error(json?.error?.message || `Facebook Live API error (${res.status}): ${text.slice(0, 200)}`);
  }

  const videoId: string = json.id;
  const streamUrl: string = json.stream_url;
  const permalink = json.permalink_url || `https://www.facebook.com/${pageId}/videos/${videoId}`;

  if (!videoId || !streamUrl) {
    throw new Error(
      `Facebook Live: missing video ID or stream URL in response. ` +
      `Got: ${text.slice(0, 300)}`
    );
  }

  return { videoId, streamUrl, permalink };
}

export async function endFacebookLiveVideo(userId: string, videoId: string): Promise<void> {
  try {
    const { pageToken } = await getFacebookPageToken(userId);
    const body = new URLSearchParams({ end_live_video: "true", access_token: pageToken });
    await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${videoId}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    });
  } catch {
    // non-fatal
  }
}

// ─── FFmpeg Streaming ─────────────────────────────────────────────────────────

function buildFfmpegArgs(videoPath: string, rtmpTargets: string[]): string[] {
  const baseEncoding = [
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-b:v", "3000k",
    "-maxrate", "3000k",
    "-bufsize", "6000k",
    "-pix_fmt", "yuv420p",
    "-g", "50",
    "-c:a", "aac",
    "-b:a", "128k",
    "-ar", "44100",
    "-threads", "0",
  ];

  if (rtmpTargets.length === 1) {
    return ["-re", "-stream_loop", "-1", "-i", videoPath, ...baseEncoding, "-f", "flv", rtmpTargets[0]];
  }

  // Tee muxer for multiple destinations simultaneously
  const teeOutput = rtmpTargets.map((url) => `[f=flv]${url}`).join("|");
  return ["-re", "-stream_loop", "-1", "-i", videoPath, ...baseEncoding, "-f", "tee", teeOutput];
}

export function startFfmpegStream(videoPath: string, rtmpTargets: string[]): ChildProcess {
  const ffmpegBin = process.env.FFMPEG_PATH || "ffmpeg";
  const args = buildFfmpegArgs(videoPath, rtmpTargets);

  const proc = spawn(ffmpegBin, args, {
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });

  if (proc.pid) runningProcesses.set(proc.pid, proc);

  proc.on("exit", () => {
    if (proc.pid) runningProcesses.delete(proc.pid);
  });

  return proc;
}

export function stopFfmpegStream(pid: number): void {
  const proc = runningProcesses.get(pid);
  if (proc) {
    proc.kill("SIGTERM");
    runningProcesses.delete(pid);
    return;
  }
  // Fallback: try kill by PID even if not in map (e.g. after server restart)
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    // already dead — ignore
  }
}

// ─── Orchestration ────────────────────────────────────────────────────────────

export async function startLiveStream(
  streamId: string,
  userId: string,
  videoPath: string,
  platforms: ("youtube" | "facebook")[]
): Promise<void> {
  const rtmpTargets: string[] = [];

  try {
    const stream = await prisma.liveStream.findUnique({ where: { id: streamId } });
    if (!stream) throw new Error("Stream record not found");

    const title = stream.title;
    const description = stream.description;

    // Set up YouTube
    if (platforms.includes("youtube")) {
      const yt = await createYoutubeLiveBroadcast(userId, title, description);
      await prisma.liveStream.update({
        where: { id: streamId },
        data: {
          youtubeBroadcastId: yt.broadcastId,
          youtubeStreamId: yt.streamId,
          youtubeStreamKey: yt.streamKey,
          youtubeRtmpUrl: yt.rtmpUrl,
          youtubeWatchUrl: yt.watchUrl,
        },
      });
      // YouTube RTMP URL needs stream key appended: ingestionAddress/streamName
      rtmpTargets.push(`${yt.rtmpUrl}/${yt.streamKey}`);
    }

    // Set up Facebook
    if (platforms.includes("facebook")) {
      const fb = await createFacebookLiveVideo(userId, title, description);
      await prisma.liveStream.update({
        where: { id: streamId },
        data: {
          facebookVideoId: fb.videoId,
          facebookStreamUrl: fb.streamUrl,
          facebookPermalink: fb.permalink,
        },
      });
      rtmpTargets.push(fb.streamUrl);
    }

    if (rtmpTargets.length === 0) throw new Error("No platforms configured");

    // Start FFmpeg
    const proc = startFfmpegStream(videoPath, rtmpTargets);

    if (!proc.pid) throw new Error("FFmpeg failed to start");

    await prisma.liveStream.update({
      where: { id: streamId },
      data: { ffmpegPid: proc.pid, status: "LIVE" },
    });

    // Poll YouTube until the ingest stream is active, then transition to LIVE.
    // enableAutoStart=true handles it automatically on supported accounts, but
    // we also poll-and-transition manually as a fallback.
    if (platforms.includes("youtube")) {
      void (async () => {
        const s = await prisma.liveStream.findUnique({ where: { id: streamId } });
        if (!s?.youtubeStreamId || !s.youtubeBroadcastId) return;
        const ytAuth = await getAuthClientForUser(userId);
        const yt = google.youtube({ version: "v3", auth: ytAuth });
        // Wait up to 3 minutes for stream to become active (FFmpeg needs time to connect)
        for (let i = 0; i < 18; i++) {
          await new Promise((r) => setTimeout(r, 10_000));
          try {
            const statusRes = await yt.liveStreams.list({
              part: ["status"],
              id: [s.youtubeStreamId],
            });
            const streamStatus = statusRes.data.items?.[0]?.status?.streamStatus;
            if (streamStatus === "active") {
              await transitionYoutubeBroadcast(userId, s.youtubeBroadcastId, "live").catch(() => {});
              return;
            }
          } catch {
            // non-fatal — keep polling
          }
        }
      })();
    }

    // Auto-mark as failed if FFmpeg exits unexpectedly
    proc.on("exit", async (code) => {
      const s = await prisma.liveStream.findUnique({ where: { id: streamId } }).catch(() => null);
      if (s && s.status === "LIVE") {
        await prisma.liveStream
          .update({ where: { id: streamId }, data: { status: "FAILED", endedAt: new Date(), errorMessage: `FFmpeg exited (code ${code})` } })
          .catch(() => {});
      }
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Live stream failed to start";
    await prisma.liveStream
      .update({ where: { id: streamId }, data: { status: "FAILED", errorMessage: msg, endedAt: new Date() } })
      .catch(() => {});
    throw err;
  }
}

export async function stopLiveStream(streamId: string, userId: string): Promise<void> {
  const stream = await prisma.liveStream.findUnique({ where: { id: streamId } });
  if (!stream) throw new Error("Stream not found");

  await prisma.liveStream.update({ where: { id: streamId }, data: { status: "ENDING" } });

  // Kill FFmpeg
  if (stream.ffmpegPid) stopFfmpegStream(stream.ffmpegPid);

  // End YouTube broadcast
  if (stream.youtubeBroadcastId) {
    await endYoutubeLiveBroadcast(userId, stream.youtubeBroadcastId);
  }

  // End Facebook live video
  if (stream.facebookVideoId) {
    await endFacebookLiveVideo(userId, stream.facebookVideoId);
  }

  await prisma.liveStream.update({
    where: { id: streamId },
    data: { status: "ENDED", endedAt: new Date(), ffmpegPid: null },
  });
}
