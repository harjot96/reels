"use client";
import { Zap, Clock, Upload, Video, Scissors, ExternalLink, Camera, ThumbsUp, Ghost, GitBranch, Timer } from "lucide-react";
import type { NodeType } from "@/lib/workflow/types";
import { NODE_META } from "@/lib/workflow/types";

const palette: { type: NodeType; icon: React.ElementType }[] = [
  { type: "trigger_manual",           icon: Zap },
  { type: "trigger_schedule",         icon: Clock },
  { type: "action_upload_video",      icon: Upload },
  { type: "action_generate_video",    icon: Video },
  { type: "action_create_shorts",     icon: Scissors },
  { type: "action_publish_youtube",   icon: ExternalLink },
  { type: "action_publish_instagram", icon: Camera },
  { type: "action_publish_facebook",  icon: ThumbsUp },
  { type: "action_publish_snapchat",  icon: Ghost },
  { type: "condition_if_else",        icon: GitBranch },
  { type: "delay",                    icon: Timer },
];

const categoryLabel: Record<string, string> = {
  trigger: "Triggers",
  action: "Actions",
  logic: "Logic",
};

export function NodePalette() {
  function onDragStart(e: React.DragEvent, type: NodeType) {
    e.dataTransfer.setData("application/reactflow-nodetype", type);
    e.dataTransfer.effectAllowed = "move";
  }

  const grouped = palette.reduce<Record<string, typeof palette>>((acc, item) => {
    const cat = NODE_META[item.type].category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <div className="w-52 shrink-0 border-r border-border bg-card/80 flex flex-col h-full overflow-y-auto">
      <div className="p-3 border-b border-border">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nodes</p>
      </div>
      <div className="p-2 space-y-4 flex-1">
        {(["trigger", "action", "logic"] as const).map((cat) => (
          <div key={cat}>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1">
              {categoryLabel[cat]}
            </p>
            <div className="space-y-1">
              {(grouped[cat] ?? []).map(({ type, icon: Icon }) => {
                const meta = NODE_META[type];
                return (
                  <div
                    key={type}
                    draggable
                    onDragStart={(e) => onDragStart(e, type)}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-border bg-secondary/30 cursor-grab hover:border-primary/50 hover:bg-secondary/60 transition-colors select-none"
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: meta.color }} />
                    <span className="text-[11px] font-medium">{meta.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
