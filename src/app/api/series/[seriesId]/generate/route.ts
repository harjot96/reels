import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runPipeline } from "@/lib/pipeline";
import { GeneratedScript } from "@/lib/claude";

export async function POST(req: NextRequest, { params }: { params: { seriesId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const series = await prisma.series.findFirst({
    where: { id: params.seriesId, userId },
  });
  if (!series) return NextResponse.json({ error: "Series not found" }, { status: 404 });

  let durationOverride: number | undefined;
  let preResearch: { research: string; angle: string } | undefined;
  let preScript: GeneratedScript | undefined;

  try {
    const body = await req.json();
    if (body?.duration && typeof body.duration === "number") {
      durationOverride = Math.min(Math.max(body.duration, 30), 3600);
    }
    if (body?.research && body?.angle) {
      preResearch = { research: body.research, angle: body.angle };
    }
    if (body?.script) {
      preScript = body.script as GeneratedScript;
    }
  } catch {}

  // Create video record — pre-fill title + script if confirmed by user
  const video = await prisma.video.create({
    data: {
      seriesId: series.id,
      title: preScript?.title ?? `${series.title} - Video`,
      status: "PENDING",
      script: preScript ? JSON.stringify(preScript) : undefined,
    },
  });

  const job = await prisma.generationJob.create({
    data: {
      videoId: video.id,
      currentStep: "SCRIPT",
      overallProgress: 0,
    },
  });

  // Fire-and-forget pipeline (skips script step if preScript is stored on video)
  runPipeline(video.id, durationOverride, preResearch).catch(console.error);

  return NextResponse.json({ videoId: video.id, jobId: job.id }, { status: 201 });
}
