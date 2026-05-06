import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runWorkflowExecution } from "@/lib/workflow/executor";
import { CronExpressionParser } from "cron-parser";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET || "";
  const authHeader = req.headers.get("authorization");
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workflows = await prisma.workflow.findMany({
    where: { isActive: true },
    include: { user: { select: { id: true } } },
  });

  const fired: string[] = [];

  for (const wf of workflows) {
    try {
      const nodes = JSON.parse(wf.nodes || "[]") as Array<{ data: { config: { type: string; cron?: string } } }>;
      const triggerNode = nodes.find((n) => n.data?.config?.type === "trigger_schedule");
      if (!triggerNode?.data?.config?.cron) continue;

      const cronExpr = triggerNode.data.config.cron;
      const interval = CronExpressionParser.parse(cronExpr);
      const prev = interval.prev().toDate();

      if (wf.lastCronRunAt && prev <= wf.lastCronRunAt) continue;

      // Stamp before firing to prevent double-fire
      await prisma.workflow.update({
        where: { id: wf.id },
        data: { lastCronRunAt: new Date() },
      });

      const execution = await prisma.workflowExecution.create({
        data: { workflowId: wf.id, triggeredBy: "cron", status: "RUNNING" },
      });

      // Fire and forget
      runWorkflowExecution(wf.id, execution.id, wf.user.id).catch(console.error);
      fired.push(wf.id);
    } catch {
      // skip malformed workflows
    }
  }

  return NextResponse.json({ fired, count: fired.length });
}
