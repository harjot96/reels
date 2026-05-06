import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runWorkflowExecution } from "@/lib/workflow/executor";

export async function POST(_req: NextRequest, { params }: { params: { workflowId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const workflow = await prisma.workflow.findFirst({ where: { id: params.workflowId, userId } });
  if (!workflow) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const execution = await prisma.workflowExecution.create({
    data: { workflowId: params.workflowId, status: "RUNNING", triggeredBy: "manual" },
  });

  // Fire and forget
  void runWorkflowExecution(params.workflowId, execution.id, userId);

  return NextResponse.json({ executionId: execution.id }, { status: 202 });
}

export async function GET(_req: NextRequest, { params }: { params: { workflowId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const workflow = await prisma.workflow.findFirst({ where: { id: params.workflowId, userId } });
  if (!workflow) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const execution = await prisma.workflowExecution.findFirst({
    where: { workflowId: params.workflowId },
    orderBy: { startedAt: "desc" },
  });
  return NextResponse.json(execution ?? null);
}
