import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runPipeline } from "@/lib/pipeline";

export async function POST(req: NextRequest, { params }: { params: { videoId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;

  const video = await prisma.video.findFirst({
    where: { id: params.videoId, series: { userId } },
    include: { job: true },
  });

  if (!video) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (video.status !== "FAILED") return NextResponse.json({ error: "Video is not in a failed state" }, { status: 400 });

  // Reset video and job state
  await prisma.video.update({
    where: { id: params.videoId },
    data: { status: "PENDING", errorMessage: null },
  });

  if (video.job) {
    await prisma.generationJob.update({
      where: { id: video.job.id },
      data: {
        currentStep: "SCRIPT",
        failedStep: null,
        stepProgress: 0,
        overallProgress: 0,
        stepMessage: "Retrying...",
        logs: JSON.stringify([]),
      },
    });
  } else {
    await prisma.generationJob.create({
      data: {
        videoId: params.videoId,
        currentStep: "SCRIPT",
        stepProgress: 0,
        overallProgress: 0,
        stepMessage: "Retrying...",
      },
    });
  }

  // Run pipeline in background
  runPipeline(params.videoId).catch(console.error);

  return NextResponse.json({ success: true });
}
