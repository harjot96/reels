import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadVideoToFacebook } from "@/lib/facebook";

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
  if (short.facebookPostId) {
    return NextResponse.json({ error: "Already published", facebookUrl: short.facebookUrl }, { status: 400 });
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
    const fb = await uploadVideoToFacebook(userId, short.url, title, description);
    const updated = await prisma.short.update({
      where: { id: params.shortId },
      data: {
        title,
        facebookPostId: fb.postId,
        facebookUrl: fb.permalink || null,
      },
    });

    return NextResponse.json({
      title: updated.title,
      facebookPostId: updated.facebookPostId,
      facebookUrl: updated.facebookUrl,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Facebook upload failed" },
      { status: 500 }
    );
  }
}

