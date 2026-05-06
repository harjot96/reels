import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTrendingTopics } from "@/lib/youtube";

export async function GET(
  req: NextRequest,
  { params }: { params: { seriesId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const series = await prisma.series.findUnique({ where: { id: params.seriesId } });
  if (!series || series.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const pageToken = req.nextUrl.searchParams.get("pageToken") ?? undefined;
  const result = await getTrendingTopics(session.user.id, series.niche, pageToken);
  return NextResponse.json(result);
}
