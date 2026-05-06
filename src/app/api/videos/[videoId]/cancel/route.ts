import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: { videoId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const video = await prisma.video.findUnique({
    where: { id: params.videoId },
    include: { series: true, job: true },
  });

  if (!video || video.series.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (video.status !== "GENERATING" && video.status !== "PENDING") {
    return NextResponse.json({ error: "Video is not currently generating" }, { status: 400 });
  }

  await prisma.video.update({
    where: { id: params.videoId },
    data: { status: "FAILED", errorMessage: "Cancelled by user" },
  });

  if (video.job) {
    await prisma.generationJob.update({
      where: { videoId: params.videoId },
      data: { currentStep: "FAILED", stepMessage: "Cancelled by user" },
    });
  }

  return NextResponse.json({ success: true });
}
