"use client";
import { useState } from "react";
import { Save, Play, Loader2, CheckCircle2, XCircle, ChevronDown, ChevronUp, History } from "lucide-react";

interface Props {
  name: string;
  onNameChange: (v: string) => void;
  onSave: () => void;
  onRun: () => void;
  onHistory: () => void;
  saving: boolean;
  runStatus: "idle" | "running" | "completed" | "failed";
  logs: any[];
  totalNodes: number;
  doneNodes: number;
}

export function WorkflowToolbar({ name, onNameChange, onSave, onRun, onHistory, saving, runStatus, logs, totalNodes, doneNodes }: Props) {
  const [showLogs, setShowLogs] = useState(false);

  const percent = totalNodes > 0 ? Math.round((doneNodes / totalNodes) * 100) : 0;
  const showProgress = runStatus === "running" || runStatus === "completed" || runStatus === "failed";

  const progressColor =
    runStatus === "completed" ? "bg-green-500" :
    runStatus === "failed"    ? "bg-red-500" :
    "bg-primary";

  return (
    <div className="border-b border-border bg-card/90 shrink-0">
      <div className="flex items-center gap-3 px-4 py-2">
        <input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className="bg-transparent text-sm font-semibold outline-none border-b border-transparent focus:border-primary min-w-0 flex-1 max-w-xs"
        />
        <div className="flex items-center gap-2 ml-auto">
          {runStatus !== "idle" && (
            <button
              onClick={() => setShowLogs((v) => !v)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Logs {showLogs ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}

          {/* Progress bar + percentage */}
          {showProgress && totalNodes > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-28 h-1.5 bg-secondary rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
                  style={{ width: `${percent}%` }}
                />
              </div>
              <span className={`text-xs font-semibold tabular-nums ${
                runStatus === "completed" ? "text-green-400" :
                runStatus === "failed"    ? "text-red-400" :
                "text-primary"
              }`}>
                {percent}%
              </span>
            </div>
          )}

          {runStatus === "running" && (
            <span className="flex items-center gap-1 text-xs text-amber-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              {doneNodes}/{totalNodes} nodes
            </span>
          )}
          {runStatus === "completed" && (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <CheckCircle2 className="w-3 h-3" /> Completed
            </span>
          )}
          {runStatus === "failed" && (
            <span className="flex items-center gap-1 text-xs text-red-400">
              <XCircle className="w-3 h-3" /> Failed
            </span>
          )}

          <button
            onClick={onHistory}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border hover:border-primary hover:text-primary transition-colors"
          >
            <History className="w-3 h-3" />
            History
          </button>

          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            Save
          </button>

          <button
            onClick={onRun}
            disabled={runStatus === "running" || saving}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Play className="w-3 h-3" />
            Run
          </button>
        </div>
      </div>

      {showLogs && logs.length > 0 && (
        <div className="max-h-40 overflow-y-auto border-t border-border bg-black/40 px-4 py-2 space-y-0.5">
          {logs.map((log, i) => (
            <div key={i} className={`text-[10px] font-mono flex gap-2 ${log.level === "error" ? "text-red-400" : "text-muted-foreground"}`}>
              <span className="shrink-0 text-border">{new Date(log.ts).toLocaleTimeString()}</span>
              <span className="text-foreground/60">[{log.nodeType}]</span>
              <span>{log.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
