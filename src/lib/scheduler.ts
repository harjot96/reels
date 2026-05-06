import { prisma } from "./prisma";
import { uploadVideoToYoutube, getNextYoutubePublishSlot } from "./youtube";

export async function runScheduledPublishes() {
  const dueVideos = await prisma.video.findMany({
    where: {
      status: "SCHEDULED",
      scheduledFor: { lte: new Date() },
    },
    include: {
      series: {
        include: {
          user: { include: { youtubeAccount: true } },
        },
      },
    },
  });

  const results = [];

  for (const video of dueVideos) {
    try {
      await prisma.video.update({
        where: { id: video.id },
        data: { status: "PUBLISHING" },
      });

      const scriptData = video.script ? JSON.parse(video.script) : null;

      const publishAt = await getNextYoutubePublishSlot(video.series.userId);
      const ytResult = await uploadVideoToYoutube(
        video.series.userId,
        video.videoUrl!,
        video.title,
        scriptData?.description || "",
        scriptData?.tags || [],
        publishAt
      );

      await prisma.video.update({
        where: { id: video.id },
        data: {
          status: "PUBLISHED",
          youtubeVideoId: ytResult.videoId,
          youtubeUrl: ytResult.url,
          youtubePublishAt: publishAt,
          publishedAt: new Date(),
        },
      });

      results.push({ videoId: video.id, success: true, youtubeUrl: ytResult.url });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      await prisma.video.update({
        where: { id: video.id },
        data: { status: "FAILED", errorMessage: errMsg },
      });
      results.push({ videoId: video.id, success: false, error: errMsg });
    }
  }

  return results;
}
