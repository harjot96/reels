"use client";
import { useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { X, Loader2, CheckCircle2, XCircle, MinusCircle } from "lucide-react";

interface Props {
  nodeId: string;
  status?: "running" | "done" | "error" | "skipped" | null;
  outputData?: Record<string, unknown> | null;
  children: React.ReactNode;
}

export function NodeWrapper({ nodeId, status, outputData, children }: Props) {
  const { setNodes, setEdges } = useReactFlow();
  const [showTooltip, setShowTooltip] = useState(false);

  function deleteNode(e: React.MouseEvent) {
    e.stopPropagation();
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
  }

  const tooltipEntries = outputData ? Object.entries(outputData).slice(0, 5) : [];

  return (
    <div className="relative group/node">
      {/* Delete button */}
      <button
        onClick={deleteNode}
        className="absolute -top-2 -right-2 z-10 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover/node:opacity-100 transition-opacity shadow-md hover:scale-110"
        title="Delete node"
      >
        <X className="w-3 h-3" />
      </button>

      {/* Execution status badge */}
      {status && (
        <div
          className="absolute -top-2 -left-2 z-10 cursor-default"
          onMouseEnter={() => status === "done" && setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          {status === "running" && (
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 shadow-md shadow-amber-500/40">
              <Loader2 className="w-3 h-3 text-white animate-spin" />
            </span>
          )}
          {status === "done" && (
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-green-500 shadow-md shadow-green-500/40">
              <CheckCircle2 className="w-3 h-3 text-white" />
            </span>
          )}
          {status === "error" && (
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-red-500 shadow-md shadow-red-500/40">
              <XCircle className="w-3 h-3 text-white" />
            </span>
          )}
          {status === "skipped" && (
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-zinc-500 shadow-md">
              <MinusCircle className="w-3 h-3 text-white" />
            </span>
          )}

          {/* Output data tooltip */}
          {showTooltip && tooltipEntries.length > 0 && (
            <div className="absolute top-6 left-0 z-50 min-w-[160px] rounded-lg border border-border bg-card shadow-xl p-2 space-y-1 pointer-events-none">
              {tooltipEntries.map(([k, v]) => (
                <div key={k} className="flex gap-1 text-[9px]">
                  <span className="text-muted-foreground shrink-0">{k}:</span>
                  <span className="text-foreground/80 truncate max-w-[100px]">{String(v)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Running pulse ring */}
      {status === "running" && (
        <div className="absolute inset-0 rounded-xl ring-2 ring-amber-400 ring-offset-2 ring-offset-background animate-pulse pointer-events-none" />
      )}

      {children}
    </div>
  );
}
