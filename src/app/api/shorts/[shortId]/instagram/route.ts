import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadVideoToInstagram } from "@/lib/instagram";

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
  if (short.instagramMediaId) {
    return NextResponse.json({ error: "Already published", instagramUrl: short.instagramUrl }, { status: 400 });
  }

  const body = await req.json().catch(() => ({} as { title?: unknown; description?: unknown }));
  const requestedTitle = typeof body.title === "string" ? body.title.trim() : "";
  const requestedDescription = typeof body.description === "string" ? body.description.trim() : "";

  const title = requestedTitle || short.title;
  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });

  let description = requestedDescription;
  if (!description) {
    try {
      const scriptData = short.video.script ? JSON.parse(short.video.script) : null;
      description = (typeof scriptData?.description === "string" ? scriptData.description : "") || short.video.title || "";
    } catch {
      description = short.video.title || "";
    }
  }

  try {
    const ig = await uploadVideoToInstagram(userId, short.url, title, description);
    const updated = await prisma.short.update({
      where: { id: params.shortId },
      data: {
        title,
        instagramMediaId: ig.mediaId,
        instagramUrl: ig.permalink || null,
      },
    });

    return NextResponse.json({
      title: updated.title,
      instagramMediaId: updated.instagramMediaId,
      instagramUrl: updated.instagramUrl,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Instagram upload failed" },
      { status: 500 }
    );
  }
}

