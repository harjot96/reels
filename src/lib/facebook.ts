import * as fs from "fs";
import * as path from "path";
import { prisma } from "./prisma";
import { decrypt, encrypt } from "./youtube";
import { getAbsolutePath } from "./storage";

const GRAPH_VERSION = process.env.FACEBOOK_GRAPH_VERSION || process.env.INSTAGRAM_GRAPH_VERSION || "v22.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
const OAUTH_BASE = `https://www.facebook.com/${GRAPH_VERSION}`;

type GraphApiErrorPayload = {
  error?: {
    message?: string;
    code?: number;
    error_subcode?: number;
    type?: string;
  };
};

function requireFacebookEnv() {
  const nextAuthBase = process.env.NEXTAUTH_URL
    ? process.env.NEXTAUTH_URL.replace(/\/$/, "")
    : "";
  const appId = process.env.FACEBOOK_APP_ID || process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET || process.env.INSTAGRAM_APP_SECRET;
  const redirectUri =
    process.env.FACEBOOK_REDIRECT_URI ||
    (nextAuthBase ? `${nextAuthBase}/api/auth/facebook/callback` : "") ||
    "";

  if (!appId || !appSecret || !redirectUri) {
    throw new Error("Facebook OAuth env vars are missing (FACEBOOK_APP_ID, FACEBOOK_APP_SECRET, FACEBOOK_REDIRECT_URI)");
  }
  return { appId, appSecret, redirectUri };
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function parseGraphResponse<T>(res: Response): Promise<T> {
  const json = await res.json().catch(() => ({} as GraphApiErrorPayload));
  if (!res.ok) {
    const msg = (json as GraphApiErrorPayload)?.error?.message || `Facebook API request failed (${res.status})`;
    throw new Error(msg);
  }
  return json as T;
}

async function graphGet<T>(path: string, params: Record<string, string>) {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${GRAPH_BASE}${path}?${query}`, {
    method: "GET",
    cache: "no-store",
  });
  return parseGraphResponse<T>(res);
}

async function graphPost<T>(path: string, params: Record<string, string>) {
  const body = new URLSearchParams(params);
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  return parseGraphResponse<T>(res);
}

export function getFacebookAuthUrl(state?: string): string {
  const { appId, redirectUri } = requireFacebookEnv();
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: [
      "pages_show_list",
      "pages_read_engagement",
      "pages_manage_posts",
      "instagram_content_publish",
    ].join(","),
  });
  if (state) params.set("state", state);
  return `${OAUTH_BASE}/dialog/oauth?${params.toString()}`;
}

async function exchangeCodeForLongLivedToken(code: string): Promise<{ accessToken: string; expiresIn: number }> {
  const { appId, appSecret, redirectUri } = requireFacebookEnv();
  const shortParams = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
  });
  const shortRes = await fetch(`${GRAPH_BASE}/oauth/access_token?${shortParams.toString()}`, {
    method: "GET",
    cache: "no-store",
  });
  const shortJson = await parseGraphResponse<{ access_token?: string }>(shortRes);
  const shortToken = shortJson.access_token;
  if (!shortToken) throw new Error("No access token returned by Facebook OAuth");

  return refreshLongLivedToken(shortToken);
}

async function refreshLongLivedToken(currentToken: string): Promise<{ accessToken: string; expiresIn: number }> {
  const { appId, appSecret } = requireFacebookEnv();
  const longParams = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: currentToken,
  });
  const longRes = await fetch(`${GRAPH_BASE}/oauth/access_token?${longParams.toString()}`, {
    method: "GET",
    cache: "no-store",
  });
  const longJson = await parseGraphResponse<{ access_token?: string; expires_in?: number }>(longRes);
  if (!longJson.access_token) throw new Error("No long-lived access token returned");

  return {
    accessToken: longJson.access_token,
    expiresIn: typeof longJson.expires_in === "number" ? longJson.expires_in : 60 * 24 * 3600,
  };
}

type FacebookPageAccount = {
  id: string;
  name: string;
  link?: string;
  access_token?: string;
};

async function getFacebookPageForUserToken(accessToken: string) {
  const pages = await graphGet<{ data?: FacebookPageAccount[] }>("/me/accounts", {
    fields: "id,name,link,access_token",
    limit: "50",
    access_token: accessToken,
  });
  const page = (pages.data || []).find((p) => p.id && p.access_token);
  if (!page?.id || !page.access_token) {
    throw new Error("No Facebook Page with publish permissions found for this login");
  }
  return {
    pageId: page.id,
    pageName: page.name || "Unknown Page",
    pageUrl: page.link || "",
    pageAccessToken: page.access_token,
  };
}

export async function connectFacebookFromCode(userId: string, code: string): Promise<{
  pageId: string;
  pageName: string;
  pageUrl: string;
}> {
  const token = await exchangeCodeForLongLivedToken(code);
  const page = await getFacebookPageForUserToken(token.accessToken);
  const expiry = new Date(Date.now() + token.expiresIn * 1000);

  await prisma.facebookAccount.upsert({
    where: { userId },
    create: {
      userId,
      pageId: page.pageId,
      pageName: page.pageName,
      pageUrl: page.pageUrl || null,
      userAccessToken: encrypt(token.accessToken),
      pageAccessToken: encrypt(page.pageAccessToken),
      tokenExpiry: expiry,
    },
    update: {
      pageId: page.pageId,
      pageName: page.pageName,
      pageUrl: page.pageUrl || null,
      userAccessToken: encrypt(token.accessToken),
      pageAccessToken: encrypt(page.pageAccessToken),
      tokenExpiry: expiry,
    },
  });

  return {
    pageId: page.pageId,
    pageName: page.pageName,
    pageUrl: page.pageUrl,
  };
}

async function getPageTokenForUser(userId: string) {
  const account = await prisma.facebookAccount.findUnique({ where: { userId } });
  if (!account) throw new Error("Facebook account not connected");

  let userToken = decrypt(account.userAccessToken);
  let pageToken = decrypt(account.pageAccessToken);
  let pageId = account.pageId;
  let pageName = account.pageName;
  let pageUrl = account.pageUrl || "";

  const refreshBeforeMs = 12 * 3600 * 1000;
  const now = Date.now();
  const shouldRefresh = now > account.tokenExpiry.getTime() - refreshBeforeMs;

  if (shouldRefresh) {
    try {
      const refreshed = await refreshLongLivedToken(userToken);
      userToken = refreshed.accessToken;
      const pages = await graphGet<{ data?: FacebookPageAccount[] }>("/me/accounts", {
        fields: "id,name,link,access_token",
        limit: "50",
        access_token: userToken,
      });
      const matched = (pages.data || []).find((p) => p.id === account.pageId && p.access_token);
      const fallback = (pages.data || []).find((p) => p.id && p.access_token);
      const chosen = matched || fallback;
      if (!chosen?.access_token || !chosen.id) {
        throw new Error("No Facebook Page found after token refresh");
      }

      pageToken = chosen.access_token;
      pageId = chosen.id;
      pageName = chosen.name || pageName;
      pageUrl = chosen.link || pageUrl;

      await prisma.facebookAccount.update({
        where: { userId },
        data: {
          pageId,
          pageName,
          pageUrl: pageUrl || null,
          userAccessToken: encrypt(userToken),
          pageAccessToken: encrypt(pageToken),
          tokenExpiry: new Date(Date.now() + refreshed.expiresIn * 1000),
        },
      });
    } catch {
      if (now > account.tokenExpiry.getTime()) {
        throw new Error("Facebook access token expired. Reconnect your Facebook account.");
      }
    }
  }

  return { pageId, pageName, pageUrl, pageToken };
}

const FALLBACK_TAGS = "#viral #trending #reels #foryou #fyp #explore #mustsee #video #watchthis #share";

async function generateFacebookViralTags(title: string, description: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return FALLBACK_TAGS;
  try {
    const prompt = `You are a viral social media expert specializing in Facebook video growth.

Generate 10 high-performing hashtags for this Facebook video to maximize reach and engagement.

Title: ${title}
Description: ${description.slice(0, 300)}

Rules:
- Mix broad viral tags (#viral #trending) with niche-specific tags
- All lowercase, no spaces inside hashtags
- Return ONLY the hashtags as a single space-separated line, no other text
- Example output: #viral #trending #mustsee #mindblowing #facts #truestory #fyp #foryou #reels #explore`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 150,
        messages: [{ role: "user", content: prompt }],
      }),
      cache: "no-store",
    });

    if (!res.ok) return FALLBACK_TAGS;
    const data = await res.json() as { content: { type: string; text: string }[] };
    const raw = data.content?.[0]?.text ?? "";
    // Extract all hashtags from the response regardless of surrounding text
    const tags = raw.match(/#[a-zA-Z0-9_]+/g);
    if (!tags || tags.length === 0) return FALLBACK_TAGS;
    return tags.map((t) => t.toLowerCase()).join(" ");
  } catch {
    return FALLBACK_TAGS;
  }
}

function buildFacebookCaption(description: string, hashtags: string): string {
  const d = description.trim();
  const h = hashtags.trim();
  const combined = d && h ? `${d}\n${h}` : d || h;
  return combined.slice(0, 5000);
}


async function fetchFacebookVideoPermalink(videoId: string, pageId: string, pageAccessToken: string): Promise<string> {
  try {
    const info = await graphGet<{ permalink_url?: string }>(`/${videoId}`, {
      fields: "permalink_url",
      access_token: pageAccessToken,
    });
    if (info.permalink_url) return info.permalink_url;
  } catch {
    // non-fatal
  }
  return `https://www.facebook.com/${pageId}/videos/${videoId}`;
}

const FB_UPLOAD_CHUNK_SIZE = 10 * 1024 * 1024; // 10 MB per chunk

/**
 * Upload a video to Facebook using the Resumable Upload API (chunked).
 * This avoids 413 Payload Too Large errors for large video files.
 */
async function uploadVideoResumable(
  pageId: string,
  pageToken: string,
  filePath: string,
  title: string,
  description: string
): Promise<string> {
  const fileSize = (await fs.promises.stat(filePath)).size;

  // Phase 1 — start upload session
  const startBody = new URLSearchParams({
    upload_phase: "start",
    file_size: String(fileSize),
    access_token: pageToken,
  });
  const startRes = await fetch(
    `https://graph-video.facebook.com/${GRAPH_VERSION}/${pageId}/videos`,
    { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: startBody, cache: "no-store" }
  );
  const startData = await parseGraphResponse<{ upload_session_id: string; start_offset: string }>(startRes);
  const sessionId = startData.upload_session_id;

  // Phase 2 — transfer chunks
  let startOffset = parseInt(startData.start_offset, 10) || 0;
  const fh = await fs.promises.open(filePath, "r");
  try {
    while (startOffset < fileSize) {
      const chunkSize = Math.min(FB_UPLOAD_CHUNK_SIZE, fileSize - startOffset);
      const buf = Buffer.alloc(chunkSize);
      await fh.read(buf, 0, chunkSize, startOffset);

      const form = new FormData();
      form.append("upload_phase", "transfer");
      form.append("upload_session_id", sessionId);
      form.append("start_offset", String(startOffset));
      form.append("access_token", pageToken);
      form.append("video_file_chunk", new Blob([buf], { type: "application/octet-stream" }), "chunk");

      const transferRes = await fetch(
        `https://graph-video.facebook.com/${GRAPH_VERSION}/${pageId}/videos`,
        { method: "POST", body: form, cache: "no-store" }
      );
      const transferData = await parseGraphResponse<{ start_offset?: string }>(transferRes);
      const next = parseInt(transferData.start_offset ?? "", 10);
      // If Facebook doesn't return a next offset (last chunk ACK), advance past fileSize to exit loop
      startOffset = Number.isFinite(next) ? next : fileSize;
    }
  } finally {
    await fh.close();
  }

  // Phase 3 — finish and publish
  const finishBody = new URLSearchParams({
    upload_phase: "finish",
    upload_session_id: sessionId,
    title: title.slice(0, 255),
    description,
    published: "true",
    access_token: pageToken,
  });
  const finishRes = await fetch(
    `https://graph-video.facebook.com/${GRAPH_VERSION}/${pageId}/videos`,
    { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: finishBody, cache: "no-store" }
  );
  // Facebook may return { id }, { video_id }, or just { success: true } — handle all variants
  const finished = await parseGraphResponse<{ id?: string; video_id?: string; success?: boolean }>(finishRes);
  const returnedId = finished.id || finished.video_id;
  if (!returnedId) {
    // success:true without an ID means upload was accepted — query the page's latest video to get the ID
    const recent = await graphGet<{ data?: { id: string }[] }>(`/${pageId}/videos`, {
      fields: "id",
      limit: "1",
      access_token: pageToken,
    });
    const latestId = recent.data?.[0]?.id;
    if (!latestId) throw new Error("Facebook accepted upload but did not return a video ID");
    return latestId;
  }
  return returnedId;
}

export async function uploadVideoToFacebook(
  userId: string,
  videoApiPath: string,
  title: string,
  description?: string
): Promise<{ postId: string; permalink: string; caption: string }> {
  const { pageId, pageToken } = await getPageTokenForUser(userId);
  const viralTags = await generateFacebookViralTags(title, description || "");
  const caption = buildFacebookCaption(description || "", viralTags);
  const filePath = getAbsolutePath(videoApiPath.split("?")[0]);

  const postId = await uploadVideoResumable(pageId, pageToken, filePath, title, caption);

  await delay(1500);
  const permalink = await fetchFacebookVideoPermalink(postId, pageId, pageToken);

  return { postId, permalink, caption };
}
