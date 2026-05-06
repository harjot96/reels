import * as fs from "fs";
import * as path from "path";
import { prisma } from "./prisma";
import { decrypt, encrypt } from "./youtube";
import { getAbsolutePath } from "./storage";

const SNAP_ACCOUNTS_BASE = "https://accounts.snapchat.com/accounts/oauth2";
const SNAP_API_BASE = "https://adsapi.snapchat.com/v1";
const GRAPH_VERSION = "v1";
const CHUNK_SIZE = 10 * 1024 * 1024; // 10 MB

function requireSnapchatEnv() {
  const clientId = (process.env.SNAPCHAT_CLIENT_ID ?? "").trim();
  const clientSecret = (process.env.SNAPCHAT_CLIENT_SECRET ?? "").trim();
  const redirectUri = (process.env.SNAPCHAT_REDIRECT_URI ?? "").trim();
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Snapchat is not configured. Add SNAPCHAT_CLIENT_ID, SNAPCHAT_CLIENT_SECRET, and SNAPCHAT_REDIRECT_URI to your .env file. " +
      "Get credentials at https://kit.snapchat.com/manage"
    );
  }
  return { clientId, clientSecret, redirectUri };
}

async function snapGet<T>(endpoint: string, accessToken: string): Promise<T> {
  const res = await fetch(`${SNAP_API_BASE}${endpoint}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (json as any)?.error?.message || (json as any)?.message || `Snapchat API error (${res.status})`;
    throw new Error(msg);
  }
  return json as T;
}

async function snapPost<T>(endpoint: string, accessToken: string, body: unknown): Promise<T> {
  const res = await fetch(`${SNAP_API_BASE}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (json as any)?.error?.message || (json as any)?.message || `Snapchat API error (${res.status})`;
    throw new Error(msg);
  }
  return json as T;
}

// ─── OAuth ───────────────────────────────────────────────────────────────────

export function getSnapchatAuthUrl(state?: string): string {
  const { clientId, redirectUri } = requireSnapchatEnv();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "snapchat-marketing-api",
  });
  if (state) params.set("state", state);
  return `${SNAP_ACCOUNTS_BASE}/auth?${params.toString()}`;
}

async function exchangeCode(code: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const { clientId, clientSecret, redirectUri } = requireSnapchatEnv();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  });
  const res = await fetch(`${SNAP_ACCOUNTS_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((json as any)?.error_description || "Snapchat token exchange failed");
  }
  return {
    accessToken: (json as any).access_token,
    refreshToken: (json as any).refresh_token,
    expiresIn: (json as any).expires_in ?? 3600,
  };
}

async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
  const { clientId, clientSecret } = requireSnapchatEnv();
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });
  const res = await fetch(`${SNAP_ACCOUNTS_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((json as any)?.error_description || "Snapchat token refresh failed");
  }
  return {
    accessToken: (json as any).access_token,
    expiresIn: (json as any).expires_in ?? 3600,
  };
}

export async function connectSnapchatFromCode(
  userId: string,
  code: string
): Promise<{ displayName: string; username: string }> {
  const tokens = await exchangeCode(code);
  const me = await snapGet<{ me?: { id?: string; display_name?: string; bitmoji_avatar_id?: string } }>(
    "/me",
    tokens.accessToken
  );

  const snapUserId = me.me?.id ?? "";
  const displayName = me.me?.display_name ?? "Snapchat User";
  const username = snapUserId;

  // Try to get ad account ID (for media uploads)
  let adAccountId = "";
  try {
    const accounts = await snapGet<{ adaccounts?: { adaccount?: { id?: string }[] } }>(
      "/me/adaccounts",
      tokens.accessToken
    );
    adAccountId = accounts.adaccounts?.adaccount?.[0]?.id ?? "";
  } catch {
    // non-fatal — ad account is needed for uploads but user can still connect
  }

  const expiry = new Date(Date.now() + tokens.expiresIn * 1000);

  await prisma.snapchatAccount.upsert({
    where: { userId },
    create: {
      userId,
      snapUserId,
      displayName,
      username,
      adAccountId,
      accessToken: encrypt(tokens.accessToken),
      refreshToken: encrypt(tokens.refreshToken),
      tokenExpiry: expiry,
    },
    update: {
      snapUserId,
      displayName,
      username,
      adAccountId,
      accessToken: encrypt(tokens.accessToken),
      refreshToken: encrypt(tokens.refreshToken),
      tokenExpiry: expiry,
    },
  });

  return { displayName, username };
}

async function getTokenForUser(userId: string): Promise<{ accessToken: string; adAccountId: string }> {
  const account = await prisma.snapchatAccount.findUnique({ where: { userId } });
  if (!account) throw new Error("Snapchat account not connected");

  let accessToken = decrypt(account.accessToken);
  const refreshTokenStr = decrypt(account.refreshToken);

  const refreshBeforeMs = 5 * 60 * 1000; // 5 min buffer
  if (Date.now() > account.tokenExpiry.getTime() - refreshBeforeMs) {
    try {
      const refreshed = await refreshAccessToken(refreshTokenStr);
      accessToken = refreshed.accessToken;
      await prisma.snapchatAccount.update({
        where: { userId },
        data: {
          accessToken: encrypt(accessToken),
          tokenExpiry: new Date(Date.now() + refreshed.expiresIn * 1000),
        },
      });
    } catch {
      if (Date.now() > account.tokenExpiry.getTime()) {
        throw new Error("Snapchat access token expired. Reconnect your Snapchat account.");
      }
    }
  }

  return { accessToken, adAccountId: account.adAccountId };
}

// ─── Video Upload ─────────────────────────────────────────────────────────────

/**
 * Upload a video to Snapchat using their resumable upload API and publish it
 * as a Spotlight post or Public Story.
 *
 * Requires: Snapchat Business account with an Ad Account (for media upload).
 * Scope: snapchat-marketing-api
 */
export async function uploadVideoToSnapchat(
  userId: string,
  videoApiPath: string,
  title: string,
  description?: string
): Promise<{ postId: string; shareUrl: string }> {
  const { accessToken, adAccountId } = await getTokenForUser(userId);

  if (!adAccountId) {
    throw new Error(
      "No Snapchat Ad Account found. A Snapchat Business account with an Ad Account is required for video publishing."
    );
  }

  const filePath = getAbsolutePath(videoApiPath.split("?")[0]);
  const fileSize = (await fs.promises.stat(filePath)).size;
  const filename = path.basename(filePath);

  // Step 1: Create a media record to get an upload URL
  const mediaName = title.slice(0, 100) + "_" + Date.now();
  const createRes = await snapPost<{
    request_status?: string;
    media?: Array<{ id?: string; upload_url?: string }>;
  }>(`/adaccounts/${adAccountId}/media`, accessToken, {
    media: [
      {
        name: mediaName,
        type: "VIDEO",
        ad_account_id: adAccountId,
      },
    ],
  });

  const mediaRecord = createRes.media?.[0];
  const mediaId = mediaRecord?.id;
  const uploadUrl = mediaRecord?.upload_url;

  if (!mediaId || !uploadUrl) {
    throw new Error("Snapchat did not return a media upload URL");
  }

  // Step 2: Upload video in chunks
  const fh = await fs.promises.open(filePath, "r");
  try {
    let offset = 0;
    while (offset < fileSize) {
      const chunkSize = Math.min(CHUNK_SIZE, fileSize - offset);
      const buf = Buffer.alloc(chunkSize);
      await fh.read(buf, 0, chunkSize, offset);

      const form = new FormData();
      form.append("file", new Blob([buf], { type: "video/mp4" }), filename);
      form.append("offset", String(offset));
      form.append("file_size", String(fileSize));

      const uploadRes = await fetch(uploadUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
        cache: "no-store",
      });

      if (!uploadRes.ok) {
        const errText = await uploadRes.text().catch(() => "");
        throw new Error(`Snapchat upload chunk failed (${uploadRes.status}): ${errText}`);
      }

      offset += chunkSize;
    }
  } finally {
    await fh.close();
  }

  // Step 3: Create a Spotlight/Story post using the uploaded media
  // Snapchat's Spotlight API endpoint for organic posting
  const caption = [title.trim(), (description ?? "").trim()].filter(Boolean).join("\n\n").slice(0, 250);

  const storyRes = await snapPost<{
    request_status?: string;
    story?: { id?: string; share_url?: string };
    snap?: { id?: string; share_url?: string };
  }>(`/adaccounts/${adAccountId}/media/${mediaId}/publish`, accessToken, {
    caption,
    media_id: mediaId,
    type: "SPOTLIGHT",
  });

  const postId = storyRes.story?.id ?? storyRes.snap?.id ?? mediaId;
  const shareUrl =
    storyRes.story?.share_url ??
    storyRes.snap?.share_url ??
    `https://www.snapchat.com/spotlight/${postId}`;

  return { postId, shareUrl };
}
