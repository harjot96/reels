"use client";

import { useState, useEffect, useCallback } from "react";
import { X, ChevronLeft, CheckCircle2, XCircle, Loader2, Clock } from "lucide-react";

interface ExecutionSummary {
  id: string;
  status: string;
  triggeredBy: string;
  startedAt: string;
  finishedAt: string | null;
  currentNodeId: string | null;
}

interface ExecutionLog {
  ts: string;
  nodeId: string;
  nodeType: string;
  message: string;
  level: "info" | "error";
}

interface ExecutionDetail {
  id: string;
  status: string;
  triggeredBy: string;
  startedAt: string;
  finishedAt: string | null;
  logs: string | null;
  result: string | null;
}

interface Props {
  workflowId: string;
  onClose: () => void;
}

function duration(start: string, end: string | null): string {
  if (!end) return "…";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function StatusIcon({ status }: { status: string }) {
  if (status === "COMPLETED") return <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />;
  if (status === "FAILED") return <XCircle className="w-4 h-4 text-red-400 shrink-0" />;
  return <Loader2 className="w-4 h-4 text-yellow-400 shrink-0 animate-spin" />;
}

export default function ExecutionHistoryPanel({ workflowId, onClose }: Props) {
  const [executions, setExecutions] = useState<ExecutionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<ExecutionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchList = useCallback(async () => {
    try {
      const res = await fetch(`/api/workflows/${workflowId}/executions`);
      const data = await res.json();
      setExecutions(data.executions ?? []);
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  async function openDetail(id: string) {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/workflows/${workflowId}/executions/${id}`);
      const data = await res.json();
      setDetail(data.execution ?? null);
    } finally {
      setDetailLoading(false);
    }
  }

  const logs: ExecutionLog[] = detail?.logs ? JSON.parse(detail.logs) : [];

  return (
    <div className="w-80 bg-[#0f0f0f] border-l border-white/10 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
        {detail ? (
          <button
            onClick={() => setDetail(null)}
            className="flex items-center gap-1 text-sm text-white/60 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
        ) : (
          <span className="text-sm font-medium text-white/90">Execution History</span>
        )}
        <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {detail ? (
          /* Detail view */
          <div className="p-3 space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <StatusIcon status={detail.status} />
              <span className="text-xs text-white/60">{detail.status}</span>
              <span className="ml-auto text-xs text-white/40">{duration(detail.startedAt, detail.finishedAt)}</span>
            </div>
            {detailLoading && (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 text-white/40 animate-spin" />
              </div>
            )}
            {logs.length === 0 && !detailLoading && (
              <p className="text-xs text-white/40 text-center py-6">No logs</p>
            )}
            {logs.map((log, i) => (
              <div key={i} className="text-xs border-l-2 pl-2 py-0.5" style={{ borderColor: log.level === "error" ? "#f87171" : "#6366f1" }}>
                <div className="flex items-center gap-1 text-white/40 mb-0.5">
                  <Clock className="w-2.5 h-2.5 shrink-0" />
                  <span>{new Date(log.ts).toLocaleTimeString()}</span>
                  <span className="text-white/30">·</span>
                  <span className="font-mono">{log.nodeType}</span>
                </div>
                <p className={log.level === "error" ? "text-red-400" : "text-white/80"}>{log.message}</p>
              </div>
            ))}
          </div>
        ) : loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-5 h-5 text-white/40 animate-spin" />
          </div>
        ) : executions.length === 0 ? (
          <p className="text-xs text-white/40 text-center py-12">No executions yet</p>
        ) : (
          executions.map((ex) => (
            <button
              key={ex.id}
              onClick={() => openDetail(ex.id)}
              className="w-full flex items-center gap-2 px-4 py-3 hover:bg-white/5 border-b border-white/5 text-left transition-colors"
            >
              <StatusIcon status={ex.status} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-white/80 truncate">{ex.status}</span>
                  <span className="text-[10px] px-1 rounded bg-white/10 text-white/50 shrink-0">{ex.triggeredBy}</span>
                </div>
                <div className="text-[10px] text-white/40 mt-0.5">
                  {relativeTime(ex.startedAt)} · {duration(ex.startedAt, ex.finishedAt)}
                </div>
              </div>
              <ChevronLeft className="w-3 h-3 text-white/30 rotate-180 shrink-0" />
            </button>
          ))
        )}
      </div>
    </div>
  );
}
