import { google } from "googleapis";
import * as crypto from "crypto";
import * as fs from "fs";
import { prisma } from "./prisma";
import { getAbsolutePath } from "./storage";

const SCHEDULE_GAP_MS = 10 * 60 * 1000; // 10 minutes between each video going public

/** Returns the next available YouTube publish slot for a user (10-min gaps). */
export async function getNextYoutubePublishSlot(userId: string): Promise<Date> {
  const now = new Date();
  const [latestVideo, latestShort] = await Promise.all([
    prisma.video.findFirst({
      where: { series: { userId }, youtubePublishAt: { gt: now } },
      orderBy: { youtubePublishAt: "desc" },
      select: { youtubePublishAt: true },
    }),
    prisma.short.findFirst({
      where: { video: { series: { userId } }, youtubePublishAt: { gt: now } },
      orderBy: { youtubePublishAt: "desc" },
      select: { youtubePublishAt: true },
    }),
  ]);

  const futureTimes = [latestVideo?.youtubePublishAt, latestShort?.youtubePublishAt]
    .filter(Boolean) as Date[];

  if (futureTimes.length === 0) {
    return new Date(now.getTime() + SCHEDULE_GAP_MS);
  }
  const latest = new Date(Math.max(...futureTimes.map((d) => d.getTime())));
  return new Date(latest.getTime() + SCHEDULE_GAP_MS);
}

const ALGORITHM = "aes-256-gcm";
const KEY = Buffer.from(process.env.ENCRYPTION_KEY || "12345678901234567890123456789012", "utf8").slice(0, 32);

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decrypt(data: string): string {
  const buf = Buffer.from(data, "base64");
  const iv = buf.slice(0, 12);
  const tag = buf.slice(12, 28);
  const encrypted = buf.slice(28);
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final("utf8");
}

export function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    process.env.YOUTUBE_REDIRECT_URI
  );
}

export function getAuthUrl(): string {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/youtube",            // full access — required for Live Streaming API
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube.readonly",
      "https://www.googleapis.com/auth/youtube.force-ssl",
    ],
    prompt: "consent",
  });
}

export async function getAuthClientForUser(userId: string) {
  const account = await prisma.youtubeAccount.findUnique({
    where: { userId },
  });
  if (!account) throw new Error("YouTube account not connected");

  const client = getOAuthClient();
  client.setCredentials({
    access_token: decrypt(account.accessToken),
    refresh_token: decrypt(account.refreshToken),
    expiry_date: account.tokenExpiry.getTime(),
  });

  // Auto-refresh if expired
  if (Date.now() > account.tokenExpiry.getTime() - 60000) {
    const { credentials } = await client.refreshAccessToken();
    await prisma.youtubeAccount.update({
      where: { userId },
      data: {
        accessToken: encrypt(credentials.access_token!),
        tokenExpiry: new Date(credentials.expiry_date!),
      },
    });
    client.setCredentials(credentials);
  }

  return client;
}

export async function getChannelStats(userId: string) {
  const auth = await getAuthClientForUser(userId);
  const youtube = google.youtube({ version: "v3", auth });

  const res = await youtube.channels.list({
    part: ["statistics", "snippet", "brandingSettings"],
    mine: true,
  });

  const channel = res.data.items?.[0];
  if (!channel) throw new Error("No channel found");

  return {
    channelId: channel.id ?? "",
    channelName: channel.snippet?.title ?? "",
    thumbnail: channel.snippet?.thumbnails?.default?.url ?? "",
    subscribers: Number(channel.statistics?.subscriberCount ?? 0),
    totalViews: Number(channel.statistics?.viewCount ?? 0),
    totalVideos: Number(channel.statistics?.videoCount ?? 0),
  };
}

export async function getVideoStats(userId: string, youtubeVideoIds: string[]) {
  if (!youtubeVideoIds.length) return [];
  const auth = await getAuthClientForUser(userId);
  const youtube = google.youtube({ version: "v3", auth });

  const res = await youtube.videos.list({
    part: ["statistics", "snippet"],
    id: youtubeVideoIds,
  });

  return (res.data.items ?? []).map((item) => ({
    youtubeVideoId: item.id ?? "",
    title: item.snippet?.title ?? "",
    views: Number(item.statistics?.viewCount ?? 0),
    likes: Number(item.statistics?.likeCount ?? 0),
    comments: Number(item.statistics?.commentCount ?? 0),
    thumbnail: item.snippet?.thumbnails?.medium?.url ?? "",
  }));
}

export async function uploadVideoToYoutube(
  userId: string,
  videoApiPath: string,
  title: string,
  description: string,
  tags: string[],
  publishAt?: Date
): Promise<{ videoId: string; url: string }> {
  const auth = await getAuthClientForUser(userId);
  const youtube = google.youtube({ version: "v3", auth });
  const absPath = getAbsolutePath(videoApiPath);

  const status: Record<string, string> = publishAt
    ? { privacyStatus: "private", publishAt: publishAt.toISOString() }
    : { privacyStatus: "unlisted" };

  const response = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: { title, description, tags: tags.map((t) => t.toLowerCase()), categoryId: "22" },
      status,
    },
    media: {
      mimeType: "video/mp4",
      body: fs.createReadStream(absPath),
    },
  });

  const videoId = response.data.id!;
  return {
    videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
  };
}

/** Upload a custom thumbnail for an already-uploaded YouTube video. */
export async function uploadThumbnail(
  userId: string,
  youtubeVideoId: string,
  thumbnailApiPath: string
): Promise<void> {
  const auth = await getAuthClientForUser(userId);
  const youtube = google.youtube({ version: "v3", auth });
  const absPath = getAbsolutePath(thumbnailApiPath);

  await youtube.thumbnails.set({
    videoId: youtubeVideoId,
    media: {
      mimeType: "image/jpeg",
      body: fs.createReadStream(absPath),
    },
  });
}

/** Upload an SRT caption file for an already-uploaded YouTube video. */
export async function uploadCaptions(
  userId: string,
  youtubeVideoId: string,
  srtContent: string,
  language: string = "en"
): Promise<void> {
  const auth = await getAuthClientForUser(userId);
  const youtube = google.youtube({ version: "v3", auth });

  const { Readable } = await import("stream");
  const stream = Readable.from([Buffer.from(srtContent, "utf-8")]);

  await youtube.captions.insert({
    part: ["snippet"],
    requestBody: {
      snippet: {
        videoId: youtubeVideoId,
        language,
        name: "Auto-generated",
        isDraft: false,
      },
    },
    media: { mimeType: "text/plain", body: stream },
  });
}

/**
 * Upload a YouTube Short (vertical video).
 * YouTube Shorts = vertical video ≤60s with #Shorts in title/description.
 */
export async function uploadShortToYoutube(
  userId: string,
  shortApiPath: string,
  title: string,
  description: string,
  tags: string[],
  publishAt?: Date
): Promise<{ videoId: string; url: string }> {
  const auth = await getAuthClientForUser(userId);
  const youtube = google.youtube({ version: "v3", auth });
  const absPath = getAbsolutePath(shortApiPath);

  const shortTitle = `${title.slice(0, 90)} #Shorts`;

  const status: Record<string, string> = publishAt
    ? { privacyStatus: "private", publishAt: publishAt.toISOString() }
    : { privacyStatus: "unlisted" };

  const response = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: { title: shortTitle, description: description.trim(), tags: tags.map((t) => t.toLowerCase()), categoryId: "22" },
      status,
    },
    media: { mimeType: "video/mp4", body: fs.createReadStream(absPath) },
  });

  const videoId = response.data.id!;
  return { videoId, url: `https://www.youtube.com/shorts/${videoId}` };
}

/**
 * Search YouTube for trending videos in a niche and return their titles.
 * Used to suggest fresh topic ideas to the user.
 */
export async function getTrendingTopics(
  userId: string,
  niche: string,
  pageToken?: string
): Promise<{ topics: string[]; nextPageToken?: string }> {
  try {
    const auth = await getAuthClientForUser(userId);
    const youtube = google.youtube({ version: "v3", auth });

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const res = await youtube.search.list({
      part: ["snippet"],
      q: niche,
      type: ["video"],
      order: "viewCount",
      publishedAfter: weekAgo,
      maxResults: 15,
      ...(pageToken ? { pageToken } : {}),
    });

    const topics = (res.data.items ?? [])
      .map((item) => item.snippet?.title ?? "")
      .filter(Boolean) as string[];

    return { topics, nextPageToken: res.data.nextPageToken ?? undefined };
  } catch {
    return { topics: [] };
  }
}
