import { prisma } from "./prisma";
import { cutShort, getAudioDuration, probeVideo, findExternalAudio, hasDrawtextFilter } from "./ffmpeg";

const DEFAULT_SHORT_DURATION = 60;
const DEFAULT_SPLIT_CONCURRENCY = 6;

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

export async function createShortsForVideo(
  videoId: string,
  userId: string,
  notify?: (msg: string) => void | Promise<void>,
  shortDuration?: number
): Promise<{ id: string; url: string; title: string }[]> {
  const SHORT_DURATION = shortDuration && shortDuration > 0 ? shortDuration : DEFAULT_SHORT_DURATION;
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    include: { series: true },
  });
  if (!video) throw new Error(`Video ${videoId} not found`);
  if (video.series.userId !== userId) throw new Error("Access denied");
  if (!video.videoUrl) throw new Error("Video not assembled yet");

  let totalDuration = video.durationSeconds ?? 0;
  if (!totalDuration) {
    totalDuration = Math.round(await getAudioDuration(video.videoUrl));
    await prisma.video.update({ where: { id: videoId }, data: { durationSeconds: totalDuration } });
  }

  if (totalDuration < SHORT_DURATION) {
    throw new Error(`Video is ${totalDuration}s — must be at least ${SHORT_DURATION}s to generate Shorts`);
  }

  await prisma.short.deleteMany({ where: { videoId } });

  const script = video.script ? JSON.parse(video.script) : null;
  const baseTitle = script?.title ?? video.title;
  const youtubeAccount = await prisma.youtubeAccount.findUnique({
    where: { userId },
    select: { channelName: true },
  });
  const channelName = (youtubeAccount?.channelName || video.series.title || "").trim() || undefined;

  const totalClips = Math.floor(totalDuration / SHORT_DURATION);
  const concurrency = Number(process.env.SHORTS_SPLIT_CONCURRENCY ?? "") || DEFAULT_SPLIT_CONCURRENCY;

  // Probe once up-front so each cutShort worker doesn't repeat the same I/O
  const [videoMeta, externalAudioAbs, drawtextAvailable] = await Promise.all([
    probeVideo(video.videoUrl!),
    findExternalAudio(videoId),
    hasDrawtextFilter(),
  ]);
  const cachedMeta = { ...videoMeta, externalAudioAbs, drawtextAvailable };

  notify?.(`Creating ${totalClips} short${totalClips !== 1 ? "s" : ""} from ${totalDuration}s video…`);

  const shorts = await runWithConcurrency(totalClips, concurrency, async (i) => {
    const startTime = i * SHORT_DURATION;
    const shortTitle = withPartNumber(baseTitle, i + 1, channelName);

    const shortUrl = await cutShort(
      videoId,
      video.videoUrl!,
      startTime,
      SHORT_DURATION,
      i,
      video.series.videoFormat,
      shortTitle,
      undefined,
      cachedMeta
    );

    notify?.(`Short ${i + 1}/${totalClips} done`);

    return prisma.short.create({
      data: { videoId, url: shortUrl, index: i, title: shortTitle },
    });
  });

  return shorts.map((s) => ({ id: s.id, url: s.url, title: s.title }));
}
