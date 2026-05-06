import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: { streamId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = (session.user as { id: string }).id;

    const stream = await prisma.liveStream.findUnique({ where: { id: params.streamId } });
    if (!stream || stream.userId !== userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(stream);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { streamId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = (session.user as { id: string }).id;

    const stream = await prisma.liveStream.findUnique({ where: { id: params.streamId } });
    if (!stream || stream.userId !== userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (stream.status === "ENDED" || stream.status === "FAILED") {
      return NextResponse.json({ error: "Stream already ended" }, { status: 400 });
    }

    const { stopLiveStream } = await import("@/lib/livestream");
    await stopLiveStream(params.streamId, userId);
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[DELETE /api/livestream]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
