export type NodeType =
  | "trigger_schedule"
  | "trigger_manual"
  | "action_upload_video"
  | "action_generate_video"
  | "action_create_shorts"
  | "action_publish_youtube"
  | "action_publish_instagram"
  | "action_publish_facebook"
  | "action_publish_snapchat"
  | "condition_if_else"
  | "delay";

export type NodeConfig =
  | { type: "trigger_schedule"; cron: string; label?: string }
  | { type: "trigger_manual"; label?: string }
  | {
      type: "action_upload_video";
      uploadMode?: "series" | "direct";
      seriesId?: string;
      title: string;
      videoFormat?: "landscape" | "shorts" | "square";
      videoId?: string;
      fileName?: string;
      mediaKind?: "video" | "audio";
      processing?: boolean;
      label?: string;
      retryCount?: 0|1|2|3;
      retryDelay?: number;
    }
  | { type: "action_generate_video"; seriesId: string; label?: string; retryCount?: 0|1|2|3; retryDelay?: number }
  | { type: "action_create_shorts"; videoIdSource: "upstream" | "fixed"; videoId?: string; shortDuration?: 15 | 30 | 60; label?: string; retryCount?: 0|1|2|3; retryDelay?: number }
  | { type: "action_publish_youtube"; videoIdSource: "upstream" | "fixed"; videoId?: string; tags?: string; label?: string; retryCount?: 0|1|2|3; retryDelay?: number }
  | { type: "action_publish_instagram"; videoIdSource: "upstream" | "fixed"; videoId?: string; title?: string; description?: string; tags?: string; label?: string; retryCount?: 0|1|2|3; retryDelay?: number }
  | { type: "action_publish_facebook"; videoIdSource: "upstream" | "fixed"; videoId?: string; title?: string; description?: string; tags?: string; label?: string; retryCount?: 0|1|2|3; retryDelay?: number }
  | { type: "action_publish_snapchat"; videoIdSource: "upstream" | "fixed"; videoId?: string; title?: string; description?: string; tags?: string; label?: string; retryCount?: 0|1|2|3; retryDelay?: number }
  | { type: "condition_if_else"; field: string; operator: "eq" | "neq" | "contains"; value: string; label?: string; retryCount?: 0|1|2|3; retryDelay?: number }
  | { type: "delay"; amount: number; unit: "seconds" | "minutes" | "hours"; label?: string; retryCount?: 0|1|2|3; retryDelay?: number };

export interface WorkflowNodeData {
  config: NodeConfig;
  [key: string]: unknown;
}

export interface ExecutionContext {
  workflowId: string;
  executionId: string;
  userId: string;
  outputs: Record<string, NodeOutput>;
}

export interface NodeOutput {
  success: boolean;
  branch?: "true" | "false";
  data?: Record<string, unknown>;
  error?: string;
}

export interface ExecutionLog {
  ts: string;
  nodeId: string;
  nodeType: string;
  message: string;
  level: "info" | "error";
}

export const NODE_META: Record<NodeType, { label: string; color: string; category: "trigger" | "action" | "logic" }> = {
  trigger_manual:           { label: "Manual Trigger",      color: "#f59e0b", category: "trigger" },
  trigger_schedule:         { label: "Schedule",            color: "#f59e0b", category: "trigger" },
  action_upload_video:      { label: "Upload Video / MP3",  color: "#6366f1", category: "action" },
  action_generate_video:    { label: "Generate Video",      color: "#6366f1", category: "action" },
  action_create_shorts:     { label: "Create Shorts",       color: "#6366f1", category: "action" },
  action_publish_youtube:   { label: "Publish YouTube",     color: "#ef4444", category: "action" },
  action_publish_instagram: { label: "Publish Instagram",   color: "#ec4899", category: "action" },
  action_publish_facebook:  { label: "Publish Facebook",    color: "#3b82f6", category: "action" },
  action_publish_snapchat:  { label: "Publish Snapchat",    color: "#f7c31f", category: "action" },
  condition_if_else:        { label: "Condition",           color: "#10b981", category: "logic" },
  delay:                    { label: "Delay",               color: "#8b5cf6", category: "logic" },
};
