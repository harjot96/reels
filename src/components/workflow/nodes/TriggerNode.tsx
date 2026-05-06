"use client";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Zap, Clock } from "lucide-react";
import { NODE_META } from "@/lib/workflow/types";
import { NodeWrapper } from "./NodeWrapper";

export function TriggerNode({ id, data, selected }: NodeProps) {
  const config = (data as any).config;
  const meta = NODE_META[config.type as keyof typeof NODE_META];

  return (
    <NodeWrapper nodeId={id} status={(data as any)._status} outputData={(data as any)._outputData}>
    <div
      className={`rounded-xl border-2 bg-card shadow-lg min-w-[200px] transition-all ${
        selected ? "border-amber-400 shadow-amber-400/20" : "border-amber-500/40"
      }`}
    >
      <div className="flex items-center gap-2 px-3 py-2 rounded-t-xl" style={{ background: "#f59e0b22" }}>
        {config.type === "trigger_schedule" ? (
          <Clock className="w-4 h-4 text-amber-400 shrink-0" />
        ) : (
          <Zap className="w-4 h-4 text-amber-400 shrink-0" />
        )}
        <span className="text-xs font-semibold text-amber-300">{meta.label}</span>
      </div>
      <div className="px-3 py-2">
        {config.type === "trigger_schedule" && config.cron ? (
          <p className="text-[10px] text-muted-foreground font-mono">{config.cron}</p>
        ) : (
          <p className="text-[10px] text-muted-foreground">Click to run manually</p>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-amber-400 !w-2 !h-2" />
    </div>
    </NodeWrapper>
  );
}
