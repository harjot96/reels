import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadVideoToYoutube, getNextYoutubePublishSlot } from "@/lib/youtube";
import { overlaySegmentTitles, getAudioDuration } from "@/lib/ffmpeg";

export async function POST(req: NextRequest, { params }: { params: { videoId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const video = await prisma.video.findFirst({
    where: { id: params.videoId, series: { userId } },
    include: { series: true },
  });

  if (!video) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!video.videoUrl) return NextResponse.json({ error: "Video not ready" }, { status: 400 });
  if (video.status === "PUBLISHED") return NextResponse.json({ error: "Already published" }, { status: 400 });

  const body = await req.json().catch(() => ({} as { title?: unknown; description?: unknown }));
  const requestedTitle = typeof body.title === "string" ? body.title.trim() : "";
  const requestedDescription = typeof body.description === "string" ? body.description.trim() : "";
  const hasMetadataPayload = typeof body.title === "string" || typeof body.description === "string";
  if (hasMetadataPayload && !requestedTitle) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const publishTitle = requestedTitle || video.title;

  await prisma.video.update({ where: { id: params.videoId }, data: { status: "PUBLISHING" } });

  try {
    const [scriptDataRaw, ytAccount] = await Promise.all([
      Promise.resolve(video.script ? JSON.parse(video.script) : null),
      prisma.youtubeAccount.findUnique({ where: { userId }, select: { defaultDescription: true } }),
    ]);
    const scriptData = scriptDataRaw;
    const channelDefault = ytAccount?.defaultDescription?.trim() ?? "";
    const hashtags: string[] = scriptData?.hashtags ?? [];
    const hashtagText = hashtags.join(" ").trim();
    const fallbackDescription = scriptData?.description
      ? hashtagText
        ? `${scriptData.description}\n\n${hashtagText}`
        : scriptData.description
      : hashtagText || channelDefault;
    const description = hasMetadataPayload
      ? (requestedDescription || channelDefault)
      : fallbackDescription;

    // Apply title overlay if not already done (e.g. replaced/uploaded videos)
    let uploadPath = video.videoUrl;
    const alreadyTitled = video.videoUrl.includes("video_titled") || video.videoUrl.includes("video_music");
    if (!alreadyTitled && scriptData?.segments?.length) {
      try {
        const duration = video.durationSeconds ?? await getAudioDuration(video.videoUrl);
        uploadPath = await overlaySegmentTitles(
          params.videoId,
          video.videoUrl,
          scriptData.segments,
          duration,
          scriptData.overlayTitle
        );
        // Save the titled version back to DB
        await prisma.video.update({ where: { id: params.videoId }, data: { videoUrl: uploadPath } });
      } catch { /* non-fatal — upload original if overlay fails */ }
    }

    const publishAt = await getNextYoutubePublishSlot(userId);
    const ytResult = await uploadVideoToYoutube(
      userId,
      uploadPath,
      publishTitle,
      description,
      scriptData?.tags || [],
      publishAt
    );

    await prisma.video.update({
      where: { id: params.videoId },
      data: {
        title: publishTitle,
        status: "PUBLISHED",
        youtubeVideoId: ytResult.videoId,
        youtubeUrl: ytResult.url,
        youtubePublishAt: publishAt,
        publishedAt: new Date(),
      },
    });

    return NextResponse.json({ youtubeUrl: ytResult.url, youtubePublishAt: publishAt });
  } catch (error: any) {
    await prisma.video.update({ where: { id: params.videoId }, data: { status: "READY" } });
    return NextResponse.json({ error: error?.message ?? "Upload failed" }, { status: 500 });
  }
}
