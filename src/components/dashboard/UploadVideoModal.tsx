"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, Film, X, Loader2, UploadCloud } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Format = "shorts" | "landscape";

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export default function UploadVideoModal() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [format, setFormat] = useState<Format>("shorts");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  function triggerPicker() { fileInputRef.current?.click(); }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setTitle(f.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "));
    setFormat("shorts");
    setProgress(0);
    setOpen(true);
    e.target.value = "";
  }

  function handleClose() {
    if (uploading) return;
    setOpen(false);
    setFile(null);
    setTitle("");
    setProgress(0);
  }

  async function handleUpload() {
    if (!file || !title.trim()) { toast.error("Please enter a title"); return; }
    setUploading(true);
    setProgress(5);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", title.trim());
    formData.append("videoFormat", format);

    const result = await new Promise<{ videoId?: string; error?: string }>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) setProgress(5 + Math.round((e.loaded / e.total) * 90));
      });
      xhr.addEventListener("load", () => {
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status >= 400) resolve({ error: data.error ?? `Server error ${xhr.status}` });
          else resolve(data);
        } catch { resolve({ error: "Invalid server response" }); }
      });
      xhr.addEventListener("error", () => resolve({ error: "Network error" }));
      xhr.addEventListener("abort", () => resolve({ error: "Upload cancelled" }));
      xhr.open("POST", "/api/videos/upload-direct");
      xhr.send(formData);
    });

    setUploading(false);
    if (result.error) { toast.error(result.error); return; }
    setProgress(100);

    if (format === "shorts" && result.videoId) {
      toast.loading("Cutting into Shorts…", { id: "shorts-gen" });
      const shortsRes = await fetch(`/api/videos/${result.videoId}/shorts`, { method: "POST" });
      if (shortsRes.ok) toast.success("Shorts created!", { id: "shorts-gen" });
      else { const d = await shortsRes.json().catch(() => ({})); toast.error(d.error || "Shorts generation failed", { id: "shorts-gen" }); }
    } else {
      toast.success("Video uploaded!");
    }
    setOpen(false);
    router.push(`/videos/${result.videoId}`);
    router.refresh();
  }

  return (
    <>
      <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={handleFileChange} />

      <button onClick={triggerPicker} className="btn-ghost gap-2">
        <Upload className="h-3.5 w-3.5" />
        Upload Video
      </button>

      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Video</DialogTitle>
            <DialogDescription>Choose a format before uploading.</DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {file && (
              <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-secondary/40">
                <Film className="h-4 w-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                </div>
                {!uploading && (
                  <button onClick={handleClose} className="text-muted-foreground hover:text-foreground transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Video Format</Label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: "shorts" as Format,    label: "Short",      sub: "9:16 · Vertical",  icon: "▯", badge: "YouTube Shorts" },
                  { value: "landscape" as Format, label: "Full Video", sub: "16:9 · Standard",  icon: "▭" },
                ].map((f) => (
                  <button key={f.value} type="button" disabled={uploading} onClick={() => setFormat(f.value)}
                    className={`flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 transition-colors ${
                      format === f.value ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40"
                    }`}>
                    <span className="text-3xl leading-none">{f.icon}</span>
                    <span className="text-sm font-semibold">{f.label}</span>
                    <span className="text-xs text-muted-foreground">{f.sub}</span>
                    {f.badge && <span className="text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full px-2 py-0.5 font-medium">{f.badge}</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="upload-title">Title</Label>
              <Input id="upload-title" value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter a title for this video" disabled={uploading} />
            </div>

            {uploading && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{progress < 100 ? "Uploading…" : format === "shorts" ? "Creating Shorts…" : "Done"}</span>
                  <span>{progress}%</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            <button className="btn-primary w-full justify-center" onClick={handleUpload} disabled={!file || !title.trim() || uploading}>
              {uploading ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</> : <><UploadCloud className="h-4 w-4" /> Upload</>}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
