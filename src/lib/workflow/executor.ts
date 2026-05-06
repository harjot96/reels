import { prisma } from "@/lib/prisma";
import { handleNode } from "./nodeHandlers";
import { buildVariableScope, resolveVariables } from "./variables";
import type { ExecutionContext, ExecutionLog, NodeConfig, NodeOutput } from "./types";

interface FlowNode { id: string; data: { config: { type: string; [k: string]: unknown } } }
interface FlowEdge { source: string; target: string; sourceHandle?: string | null }
type NodeRunResult =
  | { nodeId: string; skipped: true }
  | { nodeId: string; output: NodeOutput }
  | { nodeId: string; error: Error };

const DEFAULT_WORKFLOW_NODE_CONCURRENCY = 3;

function getWorkflowNodeConcurrency(): number {
  const raw = Number(process.env.WORKFLOW_NODE_CONCURRENCY ?? DEFAULT_WORKFLOW_NODE_CONCURRENCY);
  if (!Number.isFinite(raw) || raw < 1) return DEFAULT_WORKFLOW_NODE_CONCURRENCY;
  return Math.min(6, Math.floor(raw));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveConfig(config: NodeConfig, scope: Record<string, string>): NodeConfig {
  const resolved = { ...config } as Record<string, unknown>;
  for (const [k, v] of Object.entries(resolved)) {
    if (typeof v === "string") resolved[k] = resolveVariables(v, scope);
  }
  return resolved as NodeConfig;
}

async function persistLog(
  executionId: string,
  logs: ExecutionLog[],
  currentNodeId?: string,
  status?: string
) {
  await prisma.workflowExecution.update({
    where: { id: executionId },
    data: {
      logs: JSON.stringify(logs),
      ...(currentNodeId ? { currentNodeId } : {}),
      ...(status ? { status } : {}),
    },
  });
}

export async function runWorkflowExecution(
  workflowId: string,
  executionId: string,
  userId: string
) {
  const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });
  if (!workflow) return;

  const nodes: FlowNode[] = JSON.parse(workflow.nodes || "[]");
  const edges: FlowEdge[] = JSON.parse(workflow.edges || "[]");
  const logs: ExecutionLog[] = [];

  const context: ExecutionContext = { workflowId, executionId, userId, outputs: {} };

  function log(nodeId: string, nodeType: string, message: string, level: "info" | "error" = "info") {
    logs.push({ ts: new Date().toISOString(), nodeId, nodeType, message, level });
  }

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const outgoing = new Map<string, FlowEdge[]>();
  const inDegree = new Map<string, number>();
  for (const n of nodes) {
    outgoing.set(n.id, []);
    inDegree.set(n.id, 0);
  }
  for (const e of edges) {
    if (!nodeById.has(e.source) || !nodeById.has(e.target)) continue;
    outgoing.get(e.source)!.push(e);
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
  }

  const ready: string[] = [];
  const queued = new Set<string>();
  const completed = new Set<string>();
  const skipped = new Set<string>();
  const nodeConcurrency = getWorkflowNodeConcurrency();

  function enqueueIfReady(nodeId: string) {
    if (completed.has(nodeId) || queued.has(nodeId)) return;
    if ((inDegree.get(nodeId) ?? 0) <= 0) {
      ready.push(nodeId);
      queued.add(nodeId);
    }
  }

  function completeNode(nodeId: string) {
    if (completed.has(nodeId)) return;
    completed.add(nodeId);
    for (const e of outgoing.get(nodeId) ?? []) {
      const nextDeg = (inDegree.get(e.target) ?? 0) - 1;
      inDegree.set(e.target, nextDeg);
      enqueueIfReady(e.target);
    }
  }

  function markSkippedSubgraph(startNodeId: string) {
    const stack = [startNodeId];
    while (stack.length) {
      const nodeId = stack.pop()!;
      if (skipped.has(nodeId)) continue;
      skipped.add(nodeId);
      for (const e of outgoing.get(nodeId) ?? []) {
        stack.push(e.target);
      }
    }
  }

  for (const n of nodes) {
    if ((inDegree.get(n.id) ?? 0) === 0) {
      ready.push(n.id);
      queued.add(n.id);
    }
  }

  try {
    while (completed.size < nodes.length) {
      if (!ready.length) {
        const remaining = nodes
          .map((n) => n.id)
          .filter((id) => !completed.has(id))
          .join(", ");
        throw new Error(`Workflow graph stalled (possibly cyclic or disconnected): ${remaining}`);
      }

      const batch: FlowNode[] = [];
      while (ready.length && batch.length < nodeConcurrency) {
        const nodeId = ready.shift()!;
        queued.delete(nodeId);
        if (completed.has(nodeId)) continue;
        const node = nodeById.get(nodeId);
        if (node) batch.push(node);
      }
      if (!batch.length) continue;

      for (const node of batch) {
        if (skipped.has(node.id)) {
          log(node.id, node.data.config.type, "Skipped (branch not taken)", "info");
        } else {
          log(node.id, node.data.config.type, `Starting node: ${node.data.config.type}`);
        }
      }
      await persistLog(executionId, logs, batch[0].id);

      const results: NodeRunResult[] = await Promise.all(
        batch.map(async (node) => {
          if (skipped.has(node.id)) {
            return { nodeId: node.id, skipped: true as const };
          }

          // Resolve variables from upstream outputs
          const scope = buildVariableScope(context.outputs);
          const cfg = resolveConfig(node.data.config as NodeConfig, scope);

          // Retry loop
          const maxAttempts = 1 + ((cfg as any).retryCount ?? 0);
          const retryDelayMs = ((cfg as any).retryDelay ?? 5) * 1000;

          let output: NodeOutput | null = null;
          let lastErr: Error | null = null;

          // notify: appended to shared logs array AND persisted so UI sees it live
          const notify = async (msg: string) => {
            log(node.id, node.data.config.type, msg);
            await persistLog(executionId, logs, node.id).catch(() => {});
          };

          for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
              if (attempt > 1) {
                log(node.id, node.data.config.type, `Retrying node attempt ${attempt}/${maxAttempts}`);
                await persistLog(executionId, logs, node.id).catch(() => {});
                await delay(retryDelayMs);
              }
              output = await handleNode(node.id, cfg, context, notify);
              lastErr = null;
              break;
            } catch (err: any) {
              lastErr = err instanceof Error ? err : new Error(String(err));
              log(node.id, node.data.config.type, `Attempt ${attempt}/${maxAttempts} failed: ${lastErr.message}`, "error");
            }
          }

          if (lastErr || !output) {
            return { nodeId: node.id, error: lastErr ?? new Error("Node execution failed") };
          }
          return { nodeId: node.id, output };
        })
      );

      for (const result of results) {
        const node = nodeById.get(result.nodeId);
        if (!node) continue;

        if ("error" in result) {
          const err = result.error;
          log(node.id, node.data.config.type, `Failed: ${err.message}`, "error");
          await persistLog(executionId, logs, node.id, "FAILED");
          await prisma.workflowExecution.update({
            where: { id: executionId },
            data: { finishedAt: new Date() },
          });
          return;
        }

        if ("output" in result) {
          const output = result.output;
          context.outputs[node.id] = output;
          log(node.id, node.data.config.type, `Completed: ${JSON.stringify(output.data ?? {})}`);

          if (node.data.config.type === "condition_if_else" && output.branch) {
            const takenHandle = output.branch;
            for (const e of outgoing.get(node.id) ?? []) {
              if (e.sourceHandle !== takenHandle) {
                markSkippedSubgraph(e.target);
              }
            }
          }
        }

        completeNode(node.id);
      }

      await persistLog(executionId, logs, batch[0].id);
    }

    await persistLog(executionId, logs, undefined, "COMPLETED");
    await prisma.workflowExecution.update({
      where: { id: executionId },
      data: { result: JSON.stringify(context.outputs), finishedAt: new Date() },
    });
  } catch (err: any) {
    log("", "executor", `Fatal error: ${err?.message}`, "error");
    await persistLog(executionId, logs, undefined, "FAILED");
    await prisma.workflowExecution.update({
      where: { id: executionId },
      data: { finishedAt: new Date() },
    });
  }
}
