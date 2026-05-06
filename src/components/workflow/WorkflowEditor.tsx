"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { nodeTypes } from "./nodes";
import { NodePalette } from "./NodePalette";
import { NodeConfigPanel } from "./NodeConfigPanel";
import { WorkflowToolbar } from "./WorkflowToolbar";
import ExecutionHistoryPanel from "./ExecutionHistoryPanel";
import type { NodeType, WorkflowNodeData, NodeConfig } from "@/lib/workflow/types";
import { NODE_META } from "@/lib/workflow/types";

interface Props {
  workflowId: string;
  initialName: string;
  initialNodes: Node[];
  initialEdges: Edge[];
}

let nodeIdCounter = 0;
function genId() { return `node_${Date.now()}_${nodeIdCounter++}`; }

function defaultConfig(type: NodeType): NodeConfig {
  switch (type) {
    case "trigger_manual":           return { type };
    case "trigger_schedule":         return { type, cron: "0 9 * * *" };
    case "action_upload_video":      return { type, uploadMode: "series", seriesId: "", title: "", videoFormat: "landscape" };
    case "action_generate_video":    return { type, seriesId: "" };
    case "action_create_shorts":     return { type, videoIdSource: "upstream" };
    case "action_publish_youtube":   return { type, videoIdSource: "upstream" };
    case "action_publish_instagram": return { type, videoIdSource: "upstream" };
    case "action_publish_facebook":  return { type, videoIdSource: "upstream" };
    case "action_publish_snapchat":  return { type, videoIdSource: "upstream" };
    case "condition_if_else":        return { type, field: "videoId", operator: "eq", value: "" };
    case "delay":                    return { type, amount: 5, unit: "seconds" };
  }
}

export function WorkflowEditor({ workflowId, initialName, initialNodes, initialEdges }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node<WorkflowNodeData> | null>(null);
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [runStatus, setRunStatus] = useState<"idle" | "running" | "completed" | "failed">("idle");
  const [executionLogs, setExecutionLogs] = useState<any[]>([]);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [nodeStatuses, setNodeStatuses] = useState<Record<string, "running" | "done" | "error" | "skipped">>({});
  const [showHistory, setShowHistory] = useState(false);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const pollAbortRef = useRef<AbortController | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
    if (pollAbortRef.current) {
      pollAbortRef.current.abort();
      pollAbortRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  // Update node visual status from logs
  useEffect(() => {
    if (!executionLogs.length) return;
    const statuses: Record<string, "running" | "done" | "error" | "skipped"> = {};
    for (const log of executionLogs) {
      if (!log.nodeId) continue;
      if (log.message?.startsWith("Starting")) statuses[log.nodeId] = "running";
      else if (log.message?.startsWith("Completed")) statuses[log.nodeId] = "done";
      else if (log.message?.startsWith("Skipped")) statuses[log.nodeId] = "skipped";
      else if (log.level === "error") statuses[log.nodeId] = "error";
    }
    setNodeStatuses(statuses);
    setNodes((nds) =>
      nds.map((n) => {
        const s = statuses[n.id];
        const isActive = n.id === activeNodeId;
        return {
          ...n,
          data: {
            ...n.data,
            _status: s ?? null,
            _active: isActive,
          },
        };
      })
    );
  }, [executionLogs, activeNodeId]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, type: "smoothstep", animated: runStatus === "running" }, eds)),
    [setEdges, runStatus]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData("application/reactflow-nodetype") as NodeType;
      if (!type || !reactFlowInstance || !reactFlowWrapper.current) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });

      const newNode: Node<WorkflowNodeData> = {
        id: genId(),
        type,
        position,
        data: { config: defaultConfig(type) },
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [reactFlowInstance, setNodes]
  );

  function onNodeClick(_: React.MouseEvent, node: Node) {
    setSelectedNode(node as Node<WorkflowNodeData>);
    setShowHistory(false);
  }

  function onPaneClick() { setSelectedNode(null); }

  function updateNodeConfig(nodeId: string, config: NodeConfig) {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, config } } : n
      )
    );
    setSelectedNode((prev) => prev?.id === nodeId ? { ...prev, data: { ...prev.data, config } } : prev);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await fetch(`/api/workflows/${workflowId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, nodes, edges }),
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleRun() {
    stopPolling();
    await handleSave();
    setRunStatus("running");
    setExecutionLogs([]);
    setNodeStatuses({});
    // Clear all node statuses
    setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, _status: null, _active: false } })));
    const res = await fetch(`/api/workflows/${workflowId}/execute`, { method: "POST" });
    const { executionId } = await res.json();

    const pollExecution = async () => {
      try {
        const controller = new AbortController();
        pollAbortRef.current = controller;
        const r = await fetch(`/api/workflows/${workflowId}/execute`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const exec = await r.json();
        if (!exec) return;
        if (exec.currentNodeId) setActiveNodeId(exec.currentNodeId);
        if (exec.logs) {
          try { setExecutionLogs(JSON.parse(exec.logs)); } catch {}
        }
        if (exec.status !== "RUNNING") {
          setRunStatus(exec.status === "COMPLETED" ? "completed" : "failed");
          setActiveNodeId(null);
          stopPolling();
          // Populate _outputData from execution result
          if (exec.result) {
            try {
              const resultMap = JSON.parse(exec.result) as Record<string, { data?: Record<string, unknown> }>;
              setNodes((nds) => nds.map((n) => ({
                ...n,
                data: { ...n.data, _outputData: resultMap[n.id]?.data ?? null },
              })));
            } catch {}
          }
          return;
        }
      } catch {
        // Ignore abort errors; keep polling on transient fetch failures.
      }

      pollRef.current = setTimeout(pollExecution, 2000);
    };

    void pollExecution();
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <WorkflowToolbar
        name={name}
        onNameChange={setName}
        onSave={handleSave}
        onRun={handleRun}
        onHistory={() => { setShowHistory((v) => !v); setSelectedNode(null); }}
        saving={saving}
        runStatus={runStatus}
        logs={executionLogs}
        totalNodes={nodes.length}
        doneNodes={
          Object.values(nodeStatuses).filter((s) => s === "done" || s === "error" || s === "skipped").length +
          (Object.values(nodeStatuses).some((s) => s === "running") ? 0.5 : 0)
        }
      />
      <div className="flex flex-1 min-h-0">
        <NodePalette />
        <div ref={reactFlowWrapper} className="flex-1 min-h-0">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onInit={setReactFlowInstance}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onEdgeClick={(_e, edge) => setEdges((eds) => eds.filter((e) => e.id !== edge.id))}
            nodeTypes={nodeTypes}
            fitView
            deleteKeyCode="Delete"
            className="bg-background"
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#333" />
            <Controls className="[&>button]:bg-card [&>button]:border-border [&>button]:text-foreground" />
            <MiniMap
              className="!bg-card !border !border-border"
              nodeColor={(n) => {
                const type = n.type as NodeType;
                return NODE_META[type]?.color ?? "#666";
              }}
            />
          </ReactFlow>
        </div>
        {selectedNode && !showHistory && (
          <NodeConfigPanel
            node={selectedNode as Node<WorkflowNodeData>}
            onUpdate={updateNodeConfig}
            onClose={() => setSelectedNode(null)}
          />
        )}
        {showHistory && (
          <ExecutionHistoryPanel
            workflowId={workflowId}
            onClose={() => setShowHistory(false)}
          />
        )}
      </div>
    </div>
  );
}
