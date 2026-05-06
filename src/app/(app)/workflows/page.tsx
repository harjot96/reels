import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { GitBranch, Plus, Play } from "lucide-react";
import { NewWorkflowButton } from "@/components/workflow/NewWorkflowButton";

export default async function WorkflowsPage() {
  const session = await getServerSession(authOptions);
  const userId = (session!.user as { id: string }).id;

  const workflows = await prisma.workflow.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { executions: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Workflows</h1>
          <p className="text-sm text-muted-foreground">Automate your video generation and publishing pipeline</p>
        </div>
        <NewWorkflowButton />
      </div>

      {workflows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 border border-dashed border-border rounded-xl">
          <GitBranch className="w-10 h-10 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">No workflows yet</p>
          <NewWorkflowButton />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {workflows.map((wf) => (
            <Link
              key={wf.id}
              href={`/workflows/${wf.id}`}
              className="block border border-border rounded-xl p-4 bg-card hover:border-primary/50 transition-colors group"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-primary shrink-0" />
                  <p className="font-medium text-sm">{wf.name}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${wf.isActive ? "border-green-500/30 text-green-400" : "border-border text-muted-foreground"}`}>
                  {wf.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              {wf.description && (
                <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{wf.description}</p>
              )}
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Play className="w-3 h-3" /> {wf._count.executions} runs
                </span>
                <span>Updated {formatDistanceToNow(wf.updatedAt, { addSuffix: true })}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
