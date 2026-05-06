import * as crypto from "crypto";

function getSigningSecret() {
  return process.env.PUBLIC_FILE_URL_SECRET || process.env.ENCRYPTION_KEY || "public-file-secret-dev";
}

function normalizeBase(url: string) {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function signPath(pathname: string, expires: number): string {
  return crypto
    .createHmac("sha256", getSigningSecret())
    .update(`${pathname}:${expires}`)
    .digest("hex");
}

function safeEqual(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function verifySignedPublicFilePath(pathname: string, expires: number, signature: string): boolean {
  const expected = signPath(pathname, expires);
  return safeEqual(signature, expected);
}

export function getPublicBaseUrlOrThrow(): string {
  const base = process.env.PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || "";
  if (!base) {
    throw new Error("PUBLIC_BASE_URL (or NEXTAUTH_URL) is required");
  }
  return normalizeBase(base);
}

export function buildSignedPublicFileUrl(apiPath: string, ttlSeconds: number = 7200): string {
  const cleanPath = apiPath.split("?")[0];
  if (!cleanPath.startsWith("/api/files/")) {
    throw new Error("Only /api/files/* paths can be signed");
  }
  const relative = cleanPath.replace(/^\/api\/files\//, "").replace(/^\/+/, "");
  if (!relative) throw new Error("Invalid file path");

  const publicPath = `/api/public/files/${relative}`;
  const expires = Math.floor(Date.now() / 1000) + Math.max(60, ttlSeconds);
  const signature = signPath(publicPath, expires);
  const encodedRelative = relative
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

  return `${getPublicBaseUrlOrThrow()}/api/public/files/${encodedRelative}?e=${expires}&sig=${signature}`;
}
