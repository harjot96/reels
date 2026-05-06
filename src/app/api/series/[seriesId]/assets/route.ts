import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as fs from "fs";
import * as path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";

export const maxDuration = 120;

// Allow up to 100MB uploads (music files can be large)
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { seriesId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const series = await prisma.series.findFirst({
    where: { id: params.seriesId, userId: session.user.id },
  });
  if (!series) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (e) {
    return NextResponse.json({ error: "Failed to parse upload — file may be too large" }, { status: 400 });
  }

  const assetDir = path.join(path.resolve(process.env.LOCAL_STORAGE_PATH || "./storage"), "series", params.seriesId);
  await fs.promises.mkdir(assetDir, { recursive: true });

  const updates: Record<string, unknown> = {};

  // ── Logo ──────────────────────────────────────────────────────────────────
  const logoFile = formData.get("logo") as File | null;
  if (logoFile && logoFile.size > 0) {
    if (!logoFile.type.startsWith("image/")) {
      return NextResponse.json({ error: "Logo must be an image" }, { status: 400 });
    }
    const ext = (logoFile.name.split(".").pop() || "png").toLowerCase();
    const filePath = path.join(assetDir, `logo.${ext}`);
    await streamFileToDisk(logoFile, filePath);
    updates.logoUrl = `/api/files/series/${params.seriesId}/logo.${ext}`;
  }

  // ── Background music ──────────────────────────────────────────────────────
  const musicFile = formData.get("bgMusic") as File | null;
  if (musicFile && musicFile.size > 0) {
    const t = musicFile.type;
    if (!t.startsWith("audio/") && t !== "video/mp4" && t !== "video/mpeg") {
      return NextResponse.json({ error: "Music must be an audio or MP4 file" }, { status: 400 });
    }
    const ext = (musicFile.name.split(".").pop() || "mp3").toLowerCase();
    const filePath = path.join(assetDir, `bgmusic.${ext}`);
    await streamFileToDisk(musicFile, filePath);
    updates.bgMusicUrl = `/api/files/series/${params.seriesId}/bgmusic.${ext}`;
  }

  // ── Volume ────────────────────────────────────────────────────────────────
  const volumeRaw = formData.get("bgMusicVolume");
  if (volumeRaw !== null) {
    const vol = parseFloat(String(volumeRaw));
    if (!isNaN(vol)) updates.bgMusicVolume = Math.min(1, Math.max(0, vol));
  }

  // ── Clear flags ───────────────────────────────────────────────────────────
  if (formData.get("clearLogo") === "1") updates.logoUrl = null;
  if (formData.get("clearBgMusic") === "1") updates.bgMusicUrl = null;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({
      logoUrl: series.logoUrl,
      bgMusicUrl: series.bgMusicUrl,
      bgMusicVolume: series.bgMusicVolume,
    });
  }

  const updated = await prisma.series.update({
    where: { id: params.seriesId },
    data: updates,
  });

  return NextResponse.json({
    logoUrl: updated.logoUrl,
    bgMusicUrl: updated.bgMusicUrl,
    bgMusicVolume: updated.bgMusicVolume,
  });
}

async function streamFileToDisk(file: File, destPath: string): Promise<void> {
  const writeStream = fs.createWriteStream(destPath);
  const readable = Readable.fromWeb(file.stream() as any);
  await pipeline(readable, writeStream);
}
