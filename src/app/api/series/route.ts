import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({
  title: z.string().min(1),
  niche: z.string().min(1),
  description: z.string().optional(),
  language: z.string().default("en"),
  videoFormat: z.string().default("landscape"),
  style: z.string().default("cinematic"),
  voiceId: z.string().default("EXAVITQu4vr4xnSDxMaL"),
  ttsProvider: z.string().default("auto"),
  imageStyle: z.string().default("photorealistic"),
  videoDuration: z.number().min(30).max(3600).default(60),
  autoPublish: z.boolean().default(false),
  publishSchedule: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const series = await prisma.series.findMany({
    where: { userId, status: { not: "ARCHIVED" } },
    include: { _count: { select: { videos: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(series);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const data = createSchema.parse(body);
    const userId = (session.user as { id: string }).id;

    const series = await prisma.series.create({
      data: { ...data, userId },
    });

    return NextResponse.json(series, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues.map((i) => i.message).join(", ") }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
