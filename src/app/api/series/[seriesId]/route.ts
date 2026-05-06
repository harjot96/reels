import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: { seriesId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const series = await prisma.series.findFirst({
    where: { id: params.seriesId, userId },
    include: {
      videos: { orderBy: { createdAt: "desc" }, include: { job: true } },
      _count: { select: { videos: true } },
    },
  });

  if (!series) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(series);
}

export async function PATCH(req: NextRequest, { params }: { params: { seriesId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const body = await req.json();

  const series = await prisma.series.updateMany({
    where: { id: params.seriesId, userId },
    data: body,
  });

  if (series.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { seriesId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  await prisma.series.updateMany({
    where: { id: params.seriesId, userId },
    data: { status: "ARCHIVED" },
  });

  return NextResponse.json({ success: true });
}
