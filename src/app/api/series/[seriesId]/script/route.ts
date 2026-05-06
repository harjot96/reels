import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateVideoScript, ContentType } from "@/lib/claude";

export async function POST(req: NextRequest, { params }: { params: { seriesId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const series = await prisma.series.findFirst({
    where: { id: params.seriesId, userId },
  });
  if (!series) return NextResponse.json({ error: "Series not found" }, { status: 404 });

  const body = await req.json();
  const { research, angle, duration, contentType } = body as {
    research: string;
    angle: string;
    duration: number;
    contentType?: ContentType;
  };

  if (!research || !angle || !duration) {
    return NextResponse.json({ error: "Missing research, angle, or duration" }, { status: 400 });
  }

  const previousVideos = await prisma.video.findMany({
    where: { seriesId: series.id, title: { not: "" } },
    select: { title: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const previousTitles = previousVideos.map((v) => v.title).filter(Boolean);

  const script = await generateVideoScript(
    series.niche,
    duration,
    series.style,
    series.language,
    previousTitles,
    { research, angle, contentType: contentType ?? "story" }
  );

  return NextResponse.json({ script });
}
