import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadShortToYoutube, getNextYoutubePublishSlot } from "@/lib/youtube";

function withPartNumber(baseTitle: string, partNumber: number, channelName?: string) {
  const safePart = Number.isFinite(partNumber) && partNumber > 0 ? Math.floor(partNumber) : 1;
  const cleaned = baseTitle
    .trim()
    .replace(/\s*[-–—]?\s*part\s+\d+\s*$/i, "");
  const withChannel =
    channelName && cleaned.toLowerCase().startsWith(`${channelName.toLowerCase()} - `)
      ? cleaned
      : channelName
        ? `${channelName} - ${cleaned}`
        : cleaned;
  return `${withChannel} Part ${safePart}`;
}

function toBaseTitle(title: string) {
  return title
    .trim()
    .replace(/\s*[-–—]?\s*part\s+\d+\s*$/i, "");
}

export async function POST(
  req: NextRequest,
  { params }: { params: { shortId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;

  const short = await prisma.short.findUnique({
    where: { id: params.shortId },
    include: { video: { include: { series: true } } },
  });

  if (!short || short.video.series.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (short.youtubeVideoId) {
    return NextResponse.json({ error: "Already published", youtubeUrl: short.youtubeUrl }, { status: 400 });
  }

  try {
    const body = await req.json().catch(() => ({} as { title?: unknown; description?: unknown }));
    const requestedTitle =
      typeof body.title === "string" ? body.title.trim() : "";
    const requestedDescription =
      typeof body.description === "string" ? body.description.trim() : "";
    const hasMetadataPayload =
      typeof body.title === "string" || typeof body.description === "string";

    if (hasMetadataPayload && !requestedTitle) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    const scriptData = short.video.script ? JSON.parse(short.video.script) : null;
    const tags: string[] = scriptData?.tags ?? [];
    const youtubeAccount = await prisma.youtubeAccount.findUnique({
      where: { userId },
      select: { channelName: true, defaultDescription: true },
    });
    const channelDefault = youtubeAccount?.defaultDescription?.trim() ?? "";
    const channelName =
      (youtubeAccount?.channelName || short.video.series.title || "").trim() || undefined;
    const titleBase = toBaseTitle(requestedTitle || short.title);
    const title = withPartNumber(titleBase, short.index + 1, channelName);
    const description = hasMetadataPayload
      ? (requestedDescription || channelDefault)
      : (scriptData?.description || channelDefault);

    // If user provided a new base title, apply it to all shorts of this video at once.
    // Skip when the base title is already the same to avoid redundant DB work in batch uploads.
    if (requestedTitle && toBaseTitle(short.title) !== titleBase) {
      const videoShorts = await prisma.short.findMany({
        where: { videoId: short.videoId },
        select: { id: true, index: true },
      });

      await prisma.$transaction(
        videoShorts.map((s) =>
          prisma.short.update({
            where: { id: s.id },
            data: { title: withPartNumber(titleBase, s.index + 1, channelName) },
          })
        )
      );
    }

    const publishAt = await getNextYoutubePublishSlot(userId);
    const yt = await uploadShortToYoutube(
      userId,
      short.url,
      title,
      description,
      tags,
      publishAt
    );

    const updated = await prisma.short.update({
      where: { id: params.shortId },
      data: { title, youtubeVideoId: yt.videoId, youtubeUrl: yt.url, youtubePublishAt: publishAt },
    });

    return NextResponse.json({
      title: updated.title,
      youtubeVideoId: updated.youtubeVideoId,
      youtubeUrl: updated.youtubeUrl,
      baseTitle: titleBase,
      renamedAll: Boolean(requestedTitle),
    });
  } catch (err: any) {
    console.error("[short publish]", err);
    return NextResponse.json(
      { error: err?.message ?? "Upload to YouTube failed" },
      { status: 500 }
    );
  }
}
