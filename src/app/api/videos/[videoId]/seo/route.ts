import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { optimizeSEO } from "@/lib/claude";

export async function GET(
  _req: NextRequest,
  { params }: { params: { videoId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const video = await prisma.video.findFirst({
    where: { id: params.videoId, series: { userId: session.user.id } },
    include: { series: true },
  });
  if (!video) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!video.script) return NextResponse.json({ error: "No script available" }, { status: 400 });

  let scriptText = "";
  try {
    const parsed = JSON.parse(video.script);
    scriptText = parsed.fullText ?? parsed.segments?.map((s: { text: string }) => s.text).join(" ") ?? "";
  } catch {
    scriptText = video.script;
  }

  const result = await optimizeSEO(
    video.title,
    video.series.niche,
    scriptText,
    video.series.language
  );

  return NextResponse.json(result);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { videoId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title } = await req.json();

  await prisma.video.updateMany({
    where: { id: params.videoId, series: { userId: session.user.id } },
    data: { title },
  });

  return NextResponse.json({ success: true });
}
