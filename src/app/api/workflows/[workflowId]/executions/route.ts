import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ workflowId: string }> }
) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { workflowId } = await params;
  const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });
  if (!workflow || workflow.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const executions = await prisma.workflowExecution.findMany({
    where: { workflowId },
    orderBy: { startedAt: "desc" },
    take: 50,
    select: {
      id: true,
      status: true,
      triggeredBy: true,
      startedAt: true,
      finishedAt: true,
      currentNodeId: true,
    },
  });

  return NextResponse.json({ executions });
}
