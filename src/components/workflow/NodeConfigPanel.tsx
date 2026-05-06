"use client";
import { useEffect, useRef, useState } from "react";
import { X, Upload, Loader2, CheckCircle2 } from "lucide-react";
import type { Node } from "@xyflow/react";
import type { WorkflowNodeData, NodeConfig } from "@/lib/workflow/types";

interface Props {
  node: Node<WorkflowNodeData>;
  onUpdate: (nodeId: string, config: NodeConfig) => void;
  onClose: () => void;
}

interface SeriesOption { id: string; title: string; logoUrl?: string | null }

const COMMON_VARS = ["videoId", "videoUrl", "title", "youtubeUrl", "instagramUrl", "facebookUrl"];

function isAudioFile(file: File): boolean {
  if (file.type.startsWith("audio/")) return true;
  const ext = file.name.split(".").pop()?.toLowerCase();
  return ["mp3", "wav", "ogg", "flac", "m4a", "aac"].includes(ext ?? "");
}

function RetryFields({ local, update }: { local: NodeConfig; update: (p: Partial<NodeConfig>) => void }) {
  if (local.type === "trigger_manual" || local.type === "trigger_schedule") return null;
  const retryCount = ("retryCount" in local ? local.retryCount : 0) ?? 0;
  const retryDelay = ("retryDelay" in local ? local.retryDelay : 5) ?? 5;
  return (
    <div className="border-t border-border pt-3 mt-1 space-y-2">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Retry</p>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-[10px] text-muted-foreground">Retries</label>
          <select
            className="mt-1 w-full bg-secondary/50 border border-border rounded px-2 py-1 text-xs outline-none focus:border-primary"
            value={retryCount}
            onChange={(e) => update({ retryCount: Number(e.target.value) as 0|1|2|3 } as any)}
          >
            <option value={0}>None</option>
            <option value={1}>1×</option>
            <option value={2}>2×</option>
            <option value={3}>3×</option>
          </select>
        </div>
        {retryCount > 0 && (
          <div className="flex-1">
            <label className="text-[10px] text-muted-foreground">Delay (s)</label>
            <input
              type="number"
              min={1}
              className="mt-1 w-full bg-secondary/50 border border-border rounded px-2 py-1 text-xs outline-none focus:border-primary"
              value={retryDelay}
              onChange={(e) => update({ retryDelay: Number(e.target.value) } as any)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function VarChips({ onInsert }: { onInsert: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {COMMON_VARS.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onInsert(`{{${v}}}`)}
          className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
        >
          {`{{${v}}}`}
        </button>
      ))}
    </div>
  );
}

export function NodeConfigPanel({ node, onUpdate, onClose }: Props) {
  const config = node.data.config;
  const [series, setSeries] = useState<SeriesOption[]>([]);
  const [local, setLocal] = useState<NodeConfig>(config);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  useEffect(() => {
    setLocal(config);
    setLogoFile(null);
  }, [node.id]);

  const uploadMode = local.type === "action_upload_video" ? (local.uploadMode ?? "series") : "series";
  const isDirectUpload = uploadMode === "direct";

  useEffect(() => {
    if (local.type === "action_generate_video" || (local.type === "action_upload_video" && !isDirectUpload)) {
      fetch("/api/series").then((r) => r.json()).then((d) => setSeries(Array.isArray(d) ? d : d.series ?? []));
    }
  }, [local.type, isDirectUpload]);

  async function handleUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || local.type !== "action_upload_video") return;
    if (!local.title?.trim()) {
      alert("Enter a title first");
      e.target.value = "";
      return;
    }

    if (!isDirectUpload && !local.seriesId) {
      alert("Select a series first");
      e.target.value = "";
      return;
    }

    const audioUpload = isAudioFile(file);
    if (isDirectUpload && audioUpload) {
      alert("Direct upload mode supports video files only.");
      e.target.value = "";
      return;
    }

    const selectedSeries = series.find((s) => s.id === local.seriesId);
    if (!isDirectUpload && audioUpload && !logoFile && !selectedSeries?.logoUrl) {
      alert("Upload a logo first (or set a series logo). MP3 conversion needs a centered logo.");
      e.target.value = "";
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("title", local.title.trim());
      if (local.videoFormat) form.append("videoFormat", local.videoFormat);

      const endpoint = isDirectUpload ? "/api/videos/upload-direct" : "/api/videos/upload";
      if (!isDirectUpload) {
        form.append("seriesId", local.seriesId || "");
        if (logoFile) form.append("logo", logoFile);
      }

      const res = await fetch(endpoint, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      const next = {
        ...local,
        videoId: data.videoId,
        fileName: file.name,
        mediaKind: isDirectUpload ? "video" : (data.mediaKind ?? (audioUpload ? "audio" : "video")),
        processing: isDirectUpload ? false : Boolean(data.processing),
      } as NodeConfig;
      setLocal(next);
      onUpdate(node.id, next);
    } catch (err: any) {
      alert(err.message || "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function update(patch: Partial<NodeConfig>) {
    const next = { ...local, ...patch } as NodeConfig;
    setLocal(next);
    onUpdate(node.id, next);
  }

  function insertVar(field: string, token: string) {
    const key = field as keyof typeof local;
    const current = String((local as any)[key] ?? "");
    update({ [field]: current + token } as any);
  }

  return (
    <div className="w-72 shrink-0 border-l border-border bg-card/80 flex flex-col h-full overflow-y-auto">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <p className="text-xs font-semibold">Configure Node</p>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-3 space-y-3 text-sm">
        {/* Label */}
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Label</label>
          <input
            className="mt-1 w-full bg-secondary/50 border border-border rounded px-2 py-1 text-xs outline-none focus:border-primary"
            value={"label" in local ? (local.label ?? "") : ""}
            onChange={(e) => update({ label: e.target.value } as any)}
            placeholder="Optional label..."
          />
        </div>

        {local.type === "trigger_schedule" && (
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Cron Expression</label>
            <input
              className="mt-1 w-full bg-secondary/50 border border-border rounded px-2 py-1 text-xs font-mono outline-none focus:border-primary"
              value={local.cron ?? ""}
              onChange={(e) => update({ cron: e.target.value } as any)}
              placeholder="0 9 * * *"
            />
            <p className="text-[9px] text-muted-foreground mt-1">e.g. 0 9 * * * = daily at 9am UTC</p>
          </div>
        )}

        {local.type === "action_upload_video" && (
          <>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Upload Mode</label>
              <select
                className="mt-1 w-full bg-secondary/50 border border-border rounded px-2 py-1 text-xs outline-none focus:border-primary"
                value={uploadMode}
                onChange={(e) => {
                  const mode = e.target.value as "series" | "direct";
                  setLogoFile(null);
                  update({
                    uploadMode: mode,
                    videoId: undefined,
                    fileName: undefined,
                    mediaKind: undefined,
                    processing: undefined,
                  } as any);
                }}
              >
                <option value="series">Series Upload (Video/MP3)</option>
                <option value="direct">Direct Video Upload</option>
              </select>
            </div>
            {!isDirectUpload && (
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Series</label>
                <select
                  className="mt-1 w-full bg-secondary/50 border border-border rounded px-2 py-1 text-xs outline-none focus:border-primary"
                  value={local.seriesId ?? ""}
                  onChange={(e) => update({ seriesId: e.target.value } as any)}
                >
                  <option value="">Select a series...</option>
                  {series.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Title</label>
              <input
                className="mt-1 w-full bg-secondary/50 border border-border rounded px-2 py-1 text-xs outline-none focus:border-primary"
                value={"title" in local ? (local.title ?? "") : ""}
                onChange={(e) => update({ title: e.target.value } as any)}
                placeholder="Enter title..."
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Video Format</label>
              <select
                className="mt-1 w-full bg-secondary/50 border border-border rounded px-2 py-1 text-xs outline-none focus:border-primary"
                value={"videoFormat" in local && local.videoFormat ? local.videoFormat : "landscape"}
                onChange={(e) => update({ videoFormat: e.target.value as "landscape" | "shorts" | "square" } as any)}
              >
                <option value="landscape">Landscape (16:9)</option>
                <option value="shorts">Shorts (9:16)</option>
                <option value="square">Square (1:1)</option>
              </select>
            </div>
            {!isDirectUpload && (
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Logo for MP3 (Centered)</label>
                <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)} />
                <div className="mt-1 flex items-center gap-2">
                  <button
                    onClick={() => logoRef.current?.click()}
                    disabled={uploading}
                    className="flex-1 flex items-center justify-center gap-2 border border-dashed border-border rounded px-2 py-2 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
                  >
                    <Upload className="w-3 h-3" />
                    {logoFile ? "Replace Logo" : "Upload Logo"}
                  </button>
                  {logoFile && (
                    <button onClick={() => setLogoFile(null)} disabled={uploading} className="text-[10px] text-muted-foreground hover:text-destructive shrink-0">Clear</button>
                  )}
                </div>
                <p className="mt-1 text-[9px] text-muted-foreground truncate">
                  {logoFile ? `Selected: ${logoFile.name}` : "Used for MP3 uploads. Falls back to Series logo."}
                </p>
              </div>
            )}
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {isDirectUpload ? "Media File (Video)" : "Media File (Video or MP3)"}
              </label>
              <input
                ref={fileRef}
                type="file"
                accept={isDirectUpload ? "video/*" : "video/*,audio/*"}
                className="hidden"
                onChange={handleUploadFile}
              />
              {"videoId" in local && local.videoId ? (
                <div className="mt-1 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                  <span className="text-[10px] text-green-400 truncate">
                    {("fileName" in local && local.fileName) || "Uploaded"}
                    {"mediaKind" in local && local.mediaKind === "audio" ? " (MP3 converted)" : ""}
                  </span>
                  <button
                    onClick={() => update({ videoId: undefined, fileName: undefined, mediaKind: undefined, processing: undefined } as any)}
                    className="text-[10px] text-muted-foreground hover:text-destructive ml-auto shrink-0"
                  >Change</button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="mt-1 w-full flex items-center justify-center gap-2 border border-dashed border-border rounded px-2 py-3 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
                >
                  {uploading
                    ? <><Loader2 className="w-3 h-3 animate-spin" /> Uploading...</>
                    : <><Upload className="w-3 h-3" /> {isDirectUpload ? "Upload video" : "Upload video or MP3"}</>}
                </button>
              )}
              {!isDirectUpload && "processing" in local && local.processing && (
                <p className="mt-1 text-[9px] text-amber-300">Audio is being converted in background. You can run workflow after this turns ready.</p>
              )}
            </div>
          </>
        )}

        {local.type === "action_generate_video" && (
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Series</label>
            <select
              className="mt-1 w-full bg-secondary/50 border border-border rounded px-2 py-1 text-xs outline-none focus:border-primary"
              value={local.seriesId ?? ""}
              onChange={(e) => update({ seriesId: e.target.value } as any)}
            >
              <option value="">Select a series...</option>
              {series.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          </div>
        )}

        {(local.type === "action_create_shorts" ||
          local.type === "action_publish_youtube" ||
          local.type === "action_publish_instagram" ||
          local.type === "action_publish_facebook" ||
          local.type === "action_publish_snapchat") && (
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Video Source</label>
            <select
              className="mt-1 w-full bg-secondary/50 border border-border rounded px-2 py-1 text-xs outline-none focus:border-primary"
              value={"videoIdSource" in local ? local.videoIdSource : "upstream"}
              onChange={(e) => update({ videoIdSource: e.target.value as "upstream" | "fixed" } as any)}
            >
              <option value="upstream">Use upstream video</option>
              <option value="fixed">Fixed video ID</option>
            </select>
            {"videoIdSource" in local && local.videoIdSource === "fixed" && (
              <input
                className="mt-1 w-full bg-secondary/50 border border-border rounded px-2 py-1 text-xs outline-none focus:border-primary"
                value={local.videoId ?? ""}
                onChange={(e) => update({ videoId: e.target.value } as any)}
                placeholder="Video ID..."
              />
            )}
          </div>
        )}

        {local.type === "action_create_shorts" && (
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Short Length</label>
            <select
              className="mt-1 w-full bg-secondary/50 border border-border rounded px-2 py-1 text-xs outline-none focus:border-primary"
              value={"shortDuration" in local ? (local.shortDuration ?? 60) : 60}
              onChange={(e) => update({ shortDuration: Number(e.target.value) as 15 | 30 | 60 } as any)}
            >
              <option value={15}>15 seconds</option>
              <option value={30}>30 seconds</option>
              <option value={60}>60 seconds (default)</option>
            </select>
          </div>
        )}

        {(local.type === "action_publish_youtube") && (
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Tags (comma-separated)</label>
            <input
              className="mt-1 w-full bg-secondary/50 border border-border rounded px-2 py-1 text-xs outline-none focus:border-primary"
              value={"tags" in local ? (local.tags ?? "") : ""}
              onFocus={() => setFocusedField("tags")}
              onBlur={() => setFocusedField(null)}
              onChange={(e) => update({ tags: e.target.value } as any)}
              placeholder="cats, funny, viral — supports {{variable}}"
            />
            {focusedField === "tags" && <VarChips onInsert={(t) => insertVar("tags", t)} />}
          </div>
        )}

        {(local.type === "action_publish_instagram" || local.type === "action_publish_facebook" || local.type === "action_publish_snapchat") && (
          <>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Title (optional)</label>
              <input
                className="mt-1 w-full bg-secondary/50 border border-border rounded px-2 py-1 text-xs outline-none focus:border-primary"
                value={"title" in local ? (local.title ?? "") : ""}
                onFocus={() => setFocusedField("title")}
                onBlur={() => setFocusedField(null)}
                onChange={(e) => update({ title: e.target.value } as any)}
                placeholder="Leave blank to use video title"
              />
              {focusedField === "title" && <VarChips onInsert={(t) => insertVar("title", t)} />}
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Description</label>
              <textarea
                className="mt-1 w-full bg-secondary/50 border border-border rounded px-2 py-1 text-xs outline-none focus:border-primary resize-none"
                rows={3}
                value={"description" in local ? (local.description ?? "") : ""}
                onFocus={() => setFocusedField("description")}
                onBlur={() => setFocusedField(null)}
                onChange={(e) => update({ description: e.target.value } as any)}
                placeholder="Optional description..."
              />
              {focusedField === "description" && <VarChips onInsert={(t) => insertVar("description", t)} />}
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Hashtags (comma-separated)</label>
              <input
                className="mt-1 w-full bg-secondary/50 border border-border rounded px-2 py-1 text-xs outline-none focus:border-primary"
                value={"tags" in local ? (local.tags ?? "") : ""}
                onFocus={() => setFocusedField("tags")}
                onBlur={() => setFocusedField(null)}
                onChange={(e) => update({ tags: e.target.value } as any)}
                placeholder="cats, funny, viral — appended as #hashtags"
              />
              {focusedField === "tags" && <VarChips onInsert={(t) => insertVar("tags", t)} />}
            </div>
          </>
        )}

        {local.type === "condition_if_else" && (
          <>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Field</label>
              <input
                className="mt-1 w-full bg-secondary/50 border border-border rounded px-2 py-1 text-xs outline-none focus:border-primary"
                value={local.field ?? ""}
                onFocus={() => setFocusedField("field")}
                onBlur={() => setFocusedField(null)}
                onChange={(e) => update({ field: e.target.value } as any)}
                placeholder="e.g. videoId"
              />
              {focusedField === "field" && <VarChips onInsert={(t) => insertVar("field", t.slice(2, -2))} />}
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Operator</label>
              <select
                className="mt-1 w-full bg-secondary/50 border border-border rounded px-2 py-1 text-xs outline-none focus:border-primary"
                value={local.operator ?? "eq"}
                onChange={(e) => update({ operator: e.target.value as "eq" | "neq" | "contains" } as any)}
              >
                <option value="eq">equals</option>
                <option value="neq">not equals</option>
                <option value="contains">contains</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Value</label>
              <input
                className="mt-1 w-full bg-secondary/50 border border-border rounded px-2 py-1 text-xs outline-none focus:border-primary"
                value={local.value ?? ""}
                onFocus={() => setFocusedField("value")}
                onBlur={() => setFocusedField(null)}
                onChange={(e) => update({ value: e.target.value } as any)}
                placeholder="Expected value..."
              />
              {focusedField === "value" && <VarChips onInsert={(t) => insertVar("value", t)} />}
            </div>
          </>
        )}

        {local.type === "delay" && (
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Amount</label>
              <input
                type="number"
                min={1}
                className="mt-1 w-full bg-secondary/50 border border-border rounded px-2 py-1 text-xs outline-none focus:border-primary"
                value={"amount" in local ? local.amount : 1}
                onChange={(e) => update({ amount: Number(e.target.value) } as any)}
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Unit</label>
              <select
                className="mt-1 w-full bg-secondary/50 border border-border rounded px-2 py-1 text-xs outline-none focus:border-primary"
                value={"unit" in local ? local.unit : "seconds"}
                onChange={(e) => update({ unit: e.target.value as "seconds" | "minutes" | "hours" } as any)}
              >
                <option value="seconds">Seconds</option>
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
              </select>
            </div>
          </div>
        )}

        <RetryFields local={local} update={update} />
      </div>
    </div>
  );
}
