import { prisma } from "./prisma";
import { decrypt, encrypt } from "./youtube";
import { buildSignedPublicFileUrl, getPublicBaseUrlOrThrow } from "./publicFiles";

const GRAPH_VERSION = process.env.INSTAGRAM_GRAPH_VERSION || "v22.0";
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

function requireInstagramEnv() {
  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;
  if (!appId || !appSecret || !redirectUri) {
    throw new Error("Instagram OAuth env vars are missing (INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, INSTAGRAM_REDIRECT_URI)");
  }
  return { appId, appSecret, redirectUri };
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function parseGraphResponse<T>(res: Response): Promise<T> {
  const json = await res.json().catch(() => ({} as GraphApiErrorPayload));
  if (!res.ok) {
    const msg =
      (json as GraphApiErrorPayload)?.error?.message ||
      `Instagram API request failed (${res.status})`;
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

export function getInstagramAuthUrl(state?: string): string {
  const { appId, redirectUri } = requireInstagramEnv();
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: [
      "instagram_content_publish",
      "pages_show_list",
      "pages_read_engagement",
    ].join(","),
  });
  if (state) params.set("state", state);
  return `${OAUTH_BASE}/dialog/oauth?${params.toString()}`;
}

async function exchangeCodeForLongLivedToken(code: string): Promise<{ accessToken: string; expiresIn: number }> {
  const { appId, appSecret, redirectUri } = requireInstagramEnv();

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
  if (!shortToken) throw new Error("No access token returned by Instagram OAuth");

  const longParams = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortToken,
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

type InstagramPageAccount = {
  id: string;
  name: string;
  instagram_business_account?: {
    id: string;
    username?: string;
  };
};

async function getInstagramBusinessAccountForUserToken(accessToken: string) {
  const pages = await graphGet<{ data?: InstagramPageAccount[] }>("/me/accounts", {
    fields: "id,name,instagram_business_account{id,username}",
    limit: "50",
    access_token: accessToken,
  });

  const page = (pages.data || []).find((p) => p.instagram_business_account?.id);
  if (!page?.instagram_business_account?.id) {
    throw new Error("No Instagram Business account linked to any Facebook Page for this login");
  }

  return {
    pageId: page.id,
    pageName: page.name,
    instagramUserId: page.instagram_business_account.id,
    username: page.instagram_business_account.username || "unknown",
  };
}

async function refreshLongLivedToken(currentToken: string): Promise<{ accessToken: string; expiresIn: number }> {
  const { appId, appSecret } = requireInstagramEnv();
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: currentToken,
  });
  const res = await fetch(`${GRAPH_BASE}/oauth/access_token?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
  });
  const json = await parseGraphResponse<{ access_token?: string; expires_in?: number }>(res);
  if (!json.access_token) throw new Error("Failed to refresh Instagram token");
  return {
    accessToken: json.access_token,
    expiresIn: typeof json.expires_in === "number" ? json.expires_in : 60 * 24 * 3600,
  };
}

export async function connectInstagramFromCode(userId: string, code: string): Promise<{
  pageId: string;
  pageName: string;
  instagramUserId: string;
  username: string;
}> {
  const token = await exchangeCodeForLongLivedToken(code);
  const account = await getInstagramBusinessAccountForUserToken(token.accessToken);
  const expiry = new Date(Date.now() + token.expiresIn * 1000);

  await prisma.instagramAccount.upsert({
    where: { userId },
    create: {
      userId,
      pageId: account.pageId,
      pageName: account.pageName,
      instagramUserId: account.instagramUserId,
      username: account.username,
      accessToken: encrypt(token.accessToken),
      tokenExpiry: expiry,
    },
    update: {
      pageId: account.pageId,
      pageName: account.pageName,
      instagramUserId: account.instagramUserId,
      username: account.username,
      accessToken: encrypt(token.accessToken),
      tokenExpiry: expiry,
    },
  });

  return account;
}

async function getAccessTokenForUser(userId: string) {
  const account = await prisma.instagramAccount.findUnique({ where: { userId } });
  if (!account) throw new Error("Instagram account not connected");

  let token = decrypt(account.accessToken);
  const refreshBeforeMs = 12 * 3600 * 1000;
  const now = Date.now();
  const shouldRefresh = now > account.tokenExpiry.getTime() - refreshBeforeMs;

  if (shouldRefresh) {
    try {
      const refreshed = await refreshLongLivedToken(token);
      token = refreshed.accessToken;
      const newExpiry = new Date(Date.now() + refreshed.expiresIn * 1000);
      await prisma.instagramAccount.update({
        where: { userId },
        data: {
          accessToken: encrypt(token),
          tokenExpiry: newExpiry,
        },
      });
    } catch {
      if (now > account.tokenExpiry.getTime()) {
        throw new Error("Instagram access token expired. Reconnect your Instagram account.");
      }
    }
  }

  return { account, accessToken: token };
}

function buildCaption(title: string, description?: string): string {
  const t = title.trim();
  const d = (description || "").trim();
  if (!d) return t.slice(0, 2200);
  return `${t}\n\n${d}`.slice(0, 2200);
}

async function waitForMediaContainer(creationId: string, accessToken: string) {
  for (let i = 0; i < 120; i++) {
    const data = await graphGet<{ status_code?: string; status?: string }>(`/${creationId}`, {
      fields: "status_code,status",
      access_token: accessToken,
    });
    const status = (data.status_code || data.status || "").toUpperCase();
    if (!status || status === "IN_PROGRESS" || status === "PROCESSING") {
      await delay(5000);
      continue;
    }
    if (status === "FINISHED" || status === "PUBLISHED") return;
    if (status === "ERROR" || status === "EXPIRED") {
      throw new Error(`Instagram media processing failed (${status})`);
    }
    await delay(4000);
  }
  throw new Error("Instagram media processing timed out");
}

function ensurePublicBaseForInstagram() {
  return getPublicBaseUrlOrThrow();
}

export async function uploadVideoToInstagram(
  userId: string,
  videoApiPath: string,
  title: string,
  description?: string
): Promise<{ mediaId: string; permalink: string; caption: string }> {
  ensurePublicBaseForInstagram();
  const { account, accessToken } = await getAccessTokenForUser(userId);

  const caption = buildCaption(title, description);
  const videoUrl = buildSignedPublicFileUrl(videoApiPath, 2 * 3600);

  const creation = await graphPost<{ id?: string }>(`/${account.instagramUserId}/media`, {
    media_type: "REELS",
    video_url: videoUrl,
    caption,
    share_to_feed: "true",
    access_token: accessToken,
  });
  if (!creation.id) throw new Error("Instagram did not return a media creation ID");

  await waitForMediaContainer(creation.id, accessToken);

  const published = await graphPost<{ id?: string }>(`/${account.instagramUserId}/media_publish`, {
    creation_id: creation.id,
    access_token: accessToken,
  });
  if (!published.id) throw new Error("Instagram did not return a published media ID");

  const media = await graphGet<{ permalink?: string }>(`/${published.id}`, {
    fields: "permalink",
    access_token: accessToken,
  });

  return {
    mediaId: published.id,
    permalink: media.permalink || "",
    caption,
  };
}
