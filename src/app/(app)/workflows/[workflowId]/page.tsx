import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { WorkflowEditor } from "@/components/workflow/WorkflowEditor";
import type { Node, Edge } from "@xyflow/react";

export default async function WorkflowEditorPage({ params }: { params: { workflowId: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session!.user as { id: string }).id;

  const workflow = await prisma.workflow.findFirst({
    where: { id: params.workflowId, userId },
  });
  if (!workflow) notFound();

  let initialNodes: Node[] = [];
  let initialEdges: Edge[] = [];
  try { initialNodes = JSON.parse(workflow.nodes || "[]"); } catch {}
  try { initialEdges = JSON.parse(workflow.edges || "[]"); } catch {}

  return (
    <div className="flex flex-col flex-1 -m-6 min-h-0">
      <WorkflowEditor
        workflowId={workflow.id}
        initialName={workflow.name}
        initialNodes={initialNodes}
        initialEdges={initialEdges}
      />
    </div>
  );
}
