"use client";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Timer } from "lucide-react";
import { NodeWrapper } from "./NodeWrapper";

export function DelayNode({ id, data, selected }: NodeProps) {
  const config = (data as any).config;
  const color = "#8b5cf6";

  function label() {
    if ("amount" in config && config.amount) return `Wait ${config.amount} ${config.unit}`;
    return "Configure delay";
  }

  return (
    <NodeWrapper nodeId={id} status={(data as any)._status} outputData={(data as any)._outputData}>
      <div
        className={`rounded-xl border-2 bg-card shadow-lg min-w-[200px] transition-all`}
        style={{ borderColor: selected ? color : `${color}66` }}
      >
        <Handle type="target" position={Position.Top} className="!w-2 !h-2" style={{ background: color }} />
        <div className="flex items-center gap-2 px-3 py-2 rounded-t-xl" style={{ background: `${color}22` }}>
          <Timer className="w-4 h-4 shrink-0" style={{ color }} />
          <span className="text-xs font-semibold" style={{ color }}>Delay</span>
        </div>
        <div className="px-3 py-2">
          <p className="text-[10px] text-muted-foreground">{label()}</p>
        </div>
        <Handle type="source" position={Position.Bottom} className="!w-2 !h-2" style={{ background: color }} />
      </div>
    </NodeWrapper>
  );
}
