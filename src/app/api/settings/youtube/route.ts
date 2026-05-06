import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const account = await prisma.youtubeAccount.findUnique({
    where: { userId },
    select: { id: true, channelId: true, channelName: true, defaultDescription: true, createdAt: true },
  });

  return NextResponse.json(account);
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const body = await req.json().catch(() => ({}));
  const defaultDescription = typeof body.defaultDescription === "string" ? body.defaultDescription : "";

  const account = await prisma.youtubeAccount.update({
    where: { userId },
    data: { defaultDescription },
    select: { defaultDescription: true },
  });

  return NextResponse.json(account);
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  await prisma.youtubeAccount.deleteMany({ where: { userId } });
  return NextResponse.json({ success: true });
}
