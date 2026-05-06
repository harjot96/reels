import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { saveFile } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { seriesId, audioUrl, trackTitle } = await req.json();
  if (!seriesId || !audioUrl) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const series = await prisma.series.findFirst({
    where: { id: seriesId, userId: session.user.id },
  });
  if (!series) return NextResponse.json({ error: "Series not found" }, { status: 404 });

  try {
    // Download the track and save locally so it works like an uploaded file
    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) throw new Error("Failed to download track");
    const buffer = Buffer.from(await audioRes.arrayBuffer());
    const safeTitle = (trackTitle ?? "track").replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const localPath = await saveFile(buffer, seriesId, `bgmusic_${safeTitle}.mp3`, "audio/mpeg");

    await prisma.series.update({
      where: { id: seriesId },
      data: { bgMusicUrl: localPath },
    });

    return NextResponse.json({ ok: true, bgMusicUrl: localPath });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
