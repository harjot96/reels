import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cutShort } from "@/lib/ffmpeg";

export async function POST(
  req: NextRequest,
  { params }: { params: { shortId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const short = await prisma.short.findUnique({
    where: { id: params.shortId },
    include: { video: { include: { series: true } } },
  });

  if (!short || short.video.series.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { overlayTitle, overlayCaption } = await req.json().catch(() => ({}));

  const title = typeof overlayTitle === "string" ? overlayTitle.trim() : short.overlayTitle ?? short.title;
  const caption = typeof overlayCaption === "string" ? overlayCaption.trim() : short.overlayCaption ?? "";

  const SHORT_DURATION = 60;
  const startTime = short.index * SHORT_DURATION;

  try {
    const newUrl = await cutShort(
      short.videoId,
      short.video.videoUrl!,
      startTime,
      SHORT_DURATION,
      short.index,
      short.video.series.videoFormat,
      title,
      caption
    );

    const updated = await prisma.short.update({
      where: { id: short.id },
      data: { url: newUrl, overlayTitle: title, overlayCaption: caption },
    });

    return NextResponse.json({ short: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Render failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
