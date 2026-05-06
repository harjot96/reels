import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getWorkflow(workflowId: string, userId: string) {
  return prisma.workflow.findFirst({ where: { id: workflowId, userId } });
}

export async function GET(_req: NextRequest, { params }: { params: { workflowId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const workflow = await getWorkflow(params.workflowId, userId);
  if (!workflow) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(workflow);
}

export async function PUT(req: NextRequest, { params }: { params: { workflowId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const workflow = await getWorkflow(params.workflowId, userId);
  if (!workflow) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const updated = await prisma.workflow.update({
    where: { id: params.workflowId },
    data: {
      ...(typeof body.name === "string" ? { name: body.name } : {}),
      ...(typeof body.description === "string" ? { description: body.description } : {}),
      ...(body.nodes !== undefined ? { nodes: JSON.stringify(body.nodes) } : {}),
      ...(body.edges !== undefined ? { edges: JSON.stringify(body.edges) } : {}),
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: { workflowId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const workflow = await getWorkflow(params.workflowId, userId);
  if (!workflow) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.workflow.delete({ where: { id: params.workflowId } });
  return NextResponse.json({ ok: true });
}
