import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cutShort, getAudioDuration } from "@/lib/ffmpeg";
import { uploadShortToYoutube, getNextYoutubePublishSlot } from "@/lib/youtube";

const SHORT_DURATION = 60;
const DEFAULT_SPLIT_CONCURRENCY = 3;

function withPartNumber(baseTitle: string, partNumber: number, channelName?: string) {
  const safePart = Number.isFinite(partNumber) && partNumber > 0 ? Math.floor(partNumber) : 1;
  const cleaned = baseTitle.trim().replace(/\s*[-–—]?\s*part\s+\d+\s*$/i, "");
  const withChannel =
    channelName && cleaned.toLowerCase().startsWith(`${channelName.toLowerCase()} - `)
      ? cleaned
      : channelName
        ? `${channelName} - ${cleaned}`
        : cleaned;
  return `${withChannel} Part ${safePart}`;
}

function getSplitConcurrency(publishToYoutube: boolean) {
  if (publishToYoutube) return 1;
  const parsed = Number(process.env.SHORTS_SPLIT_CONCURRENCY ?? DEFAULT_SPLIT_CONCURRENCY);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_SPLIT_CONCURRENCY;
  return Math.min(6, Math.floor(parsed));
}

async function runWithConcurrency<T>(
  total: number,
  concurrency: number,
  worker: (index: number) => Promise<T>
): Promise<T[]> {
  const results: T[] = new Array(total);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, total) }, async () => {
    while (true) {
      const current = cursor++;
      if (current >= total) return;
      results[current] = await worker(current);
    }
  });
  await Promise.all(runners);
  return results;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { videoId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const video = await prisma.video.findUnique({
    where: { id: params.videoId },
    include: { series: true },
  });

  if (!video || video.series.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const sourceVideoUrl = video.videoUrl;
  if (!sourceVideoUrl) {
    return NextResponse.json({ error: "Video not assembled yet" }, { status: 400 });
  }

  // If duration wasn't stored at upload time, probe it now
  let totalDuration = video.durationSeconds ?? 0;
  if (!totalDuration) {
    try {
      totalDuration = Math.round(await getAudioDuration(sourceVideoUrl));
      // Persist so future requests don't need to probe again
      await prisma.video.update({ where: { id: params.videoId }, data: { durationSeconds: totalDuration } });
    } catch { /* leave as 0 — will fail below with a clear message */ }
  }

  if (totalDuration < SHORT_DURATION) {
    return NextResponse.json(
      { error: `Video is ${totalDuration}s — must be at least ${SHORT_DURATION}s to generate Shorts` },
      { status: 400 }
    );
  }

  const { publishToYoutube = false } = await req.json().catch(() => ({}));

  // Delete existing shorts for this video
  await prisma.short.deleteMany({ where: { videoId: params.videoId } });

  const script = video.script ? JSON.parse(video.script) : null;
  const baseTitle = script?.title ?? video.title;
  const tags: string[] = script?.tags ?? [];
  const youtubeAccount = await prisma.youtubeAccount.findUnique({
    where: { userId: session.user.id },
    select: { channelName: true },
  });
  const channelName =
    (youtubeAccount?.channelName || video.series.title || "").trim() || undefined;

  // Split only full 1-minute clips. Example: 18m => 18 shorts.
  const totalClips = Math.floor(totalDuration / SHORT_DURATION);
  const splitConcurrency = getSplitConcurrency(publishToYoutube);

  let shorts;
  try {
  shorts = await runWithConcurrency(totalClips, splitConcurrency, async (i) => {
    const startTime = i * SHORT_DURATION;
    const shortTitle = withPartNumber(baseTitle, i + 1, channelName);

    const shortUrl = await cutShort(
      params.videoId,
      sourceVideoUrl,
      startTime,
      SHORT_DURATION,
      i,
      video.series.videoFormat,
      shortTitle
    );

    let ytVideoId: string | undefined;
    let ytUrl: string | undefined;

    if (publishToYoutube) {
      try {
        const publishAt = await getNextYoutubePublishSlot(session.user.id);
        const yt = await uploadShortToYoutube(
          session.user.id,
          shortUrl,
          shortTitle,
          script?.description ?? "",
          tags,
          publishAt
        );
        ytVideoId = yt.videoId;
        ytUrl = yt.url;
      } catch {
        // Non-fatal for local short generation.
      }
    }

    return prisma.short.create({
      data: {
        videoId: params.videoId,
        url: shortUrl,
        index: i,
        title: shortTitle,
        youtubeVideoId: ytVideoId,
        youtubeUrl: ytUrl,
      },
    });
  });

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[shorts] generation failed:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ shorts });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { videoId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const video = await prisma.video.findUnique({
    where: { id: params.videoId },
    include: { series: true, shorts: { orderBy: { index: "asc" } } },
  });

  if (!video || video.series.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ shorts: video.shorts });
}
