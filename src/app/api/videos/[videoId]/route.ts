import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: { videoId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const video = await prisma.video.findFirst({
    where: { id: params.videoId, series: { userId } },
    include: {
      series: true,
      job: true,
      imageAssets: { orderBy: { index: "asc" } },
    },
  });

  if (!video) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(video);
}

export async function DELETE(_req: NextRequest, { params }: { params: { videoId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const video = await prisma.video.findFirst({
    where: { id: params.videoId, series: { userId } },
  });

  if (!video) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.video.delete({ where: { id: params.videoId } });
  return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest, { params }: { params: { videoId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const body = await req.json();

  await prisma.video.updateMany({
    where: { id: params.videoId, series: { userId } },
    data: body,
  });

  return NextResponse.json({ success: true });
}
