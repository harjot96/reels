import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const status = req.nextUrl.searchParams.get("status");

  const videos = await prisma.video.findMany({
    where: {
      series: { userId },
      ...(status ? { status } : {}),
    },
    include: {
      series: { select: { id: true, title: true, niche: true } },
      job: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(videos);
}
