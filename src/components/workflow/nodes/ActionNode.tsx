"use client";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Video, Scissors, ExternalLink, Camera, ThumbsUp, Ghost } from "lucide-react";
import { NODE_META, type NodeType } from "@/lib/workflow/types";
import { NodeWrapper } from "./NodeWrapper";

const iconMap: Record<string, React.ElementType> = {
  action_generate_video: Video,
  action_create_shorts: Scissors,
  action_publish_youtube: ExternalLink,
  action_publish_instagram: Camera,
  action_publish_facebook: ThumbsUp,
  action_publish_snapchat: Ghost,
};

const colorMap: Record<string, string> = {
  action_generate_video:    "#6366f1",
  action_create_shorts:     "#6366f1",
  action_publish_youtube:   "#ef4444",
  action_publish_instagram: "#ec4899",
  action_publish_facebook:  "#3b82f6",
  action_publish_snapchat:  "#f7c31f",
};

export function ActionNode({ id, data, selected }: NodeProps) {
  const config = (data as any).config;
  const meta = NODE_META[config.type as NodeType] ?? { label: config.type, color: "#666" };
  const Icon = iconMap[config.type] ?? Video;
  const color = colorMap[config.type] ?? "#6366f1";

  function subtitle() {
    if (config.type === "action_generate_video") {
      return config.seriesId ? `Series: …${config.seriesId.slice(-6)}` : "No series selected";
    }
    if ("videoIdSource" in config) {
      return config.videoIdSource === "upstream" ? "Uses upstream video" : `Video: …${(config.videoId ?? "").slice(-6)}`;
    }
    return "";
  }

  return (
    <NodeWrapper nodeId={id} status={(data as any)._status} outputData={(data as any)._outputData}>
      <div
        className={`rounded-xl border-2 bg-card shadow-lg min-w-[200px] transition-all ${
          selected ? "shadow-lg" : ""
        }`}
        style={{ borderColor: selected ? color : `${color}66` }}
      >
        <Handle type="target" position={Position.Top} className="!w-2 !h-2" style={{ background: color }} />
        <div className="flex items-center gap-2 px-3 py-2 rounded-t-xl" style={{ background: `${color}22` }}>
          <Icon className="w-4 h-4 shrink-0" style={{ color }} />
          <span className="text-xs font-semibold" style={{ color }}>{meta.label}</span>
        </div>
        <div className="px-3 py-2">
          <p className="text-[10px] text-muted-foreground">{subtitle()}</p>
        </div>
        <Handle type="source" position={Position.Bottom} className="!w-2 !h-2" style={{ background: color }} />
      </div>
    </NodeWrapper>
  );
}
