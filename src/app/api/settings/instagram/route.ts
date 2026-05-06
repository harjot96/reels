import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const account = await prisma.instagramAccount.findUnique({
    where: { userId },
    select: {
      id: true,
      pageId: true,
      pageName: true,
      instagramUserId: true,
      username: true,
      tokenExpiry: true,
      createdAt: true,
    },
  });

  return NextResponse.json(account);
}

export async function DELETE(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  await prisma.instagramAccount.deleteMany({ where: { userId } });
  return NextResponse.json({ success: true });
}

