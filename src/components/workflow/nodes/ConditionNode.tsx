"use client";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { GitBranch } from "lucide-react";
import { NodeWrapper } from "./NodeWrapper";

export function ConditionNode({ id, data, selected }: NodeProps) {
  const config = (data as any).config;
  const color = "#10b981";

  return (
    <NodeWrapper nodeId={id} status={(data as any)._status} outputData={(data as any)._outputData}>
      <div
        className={`rounded-xl border-2 bg-card shadow-lg min-w-[200px] transition-all`}
        style={{ borderColor: selected ? color : `${color}66` }}
      >
        <Handle type="target" position={Position.Top} className="!w-2 !h-2" style={{ background: color }} />
        <div className="flex items-center gap-2 px-3 py-2 rounded-t-xl" style={{ background: `${color}22` }}>
          <GitBranch className="w-4 h-4 shrink-0" style={{ color }} />
          <span className="text-xs font-semibold" style={{ color }}>Condition</span>
        </div>
        <div className="px-3 py-2">
          {"field" in config && config.field ? (
            <p className="text-[10px] text-muted-foreground font-mono">
              {config.field} {config.operator} {config.value}
            </p>
          ) : (
            <p className="text-[10px] text-muted-foreground">Configure condition</p>
          )}
        </div>
        <div className="flex justify-between px-4 pb-2">
          <span className="text-[9px] text-emerald-400">true</span>
          <span className="text-[9px] text-red-400">false</span>
        </div>
        <Handle type="source" position={Position.Bottom} id="true" style={{ left: "30%", background: "#10b981" }} className="!w-2 !h-2" />
        <Handle type="source" position={Position.Bottom} id="false" style={{ left: "70%", background: "#ef4444" }} className="!w-2 !h-2" />
      </div>
    </NodeWrapper>
  );
}
