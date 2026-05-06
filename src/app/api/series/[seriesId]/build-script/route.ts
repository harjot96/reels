import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildScriptFromRaw } from "@/lib/claude";

export async function POST(
  req: NextRequest,
  { params }: { params: { seriesId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const series = await prisma.series.findFirst({
    where: { id: params.seriesId, userId: session.user.id },
  });
  if (!series) return NextResponse.json({ error: "Series not found" }, { status: 404 });

  const { rawScript } = await req.json();
  if (!rawScript?.trim()) return NextResponse.json({ error: "Script text is required" }, { status: 400 });

  // No AI — pure local parsing
  const script = buildScriptFromRaw(rawScript, series.niche);
  return NextResponse.json({ script });
}
