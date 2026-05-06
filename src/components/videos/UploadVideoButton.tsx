"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UploadCloud, Loader2, X, Film } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface UploadVideoButtonProps {
  seriesId: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function UploadVideoButton({ seriesId }: UploadVideoButtonProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    // Auto-fill title from filename (strip extension)
    if (!title) {
      setTitle(f.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "));
    }
  }

  function handleOpen() {
    setFile(null);
    setTitle("");
    setProgress(0);
    setOpen(true);
  }

  async function handleUpload() {
    if (!file || !title.trim()) {
      toast.error("Please select a file and enter a title");
      return;
    }

    setUploading(true);
    setProgress(0);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", title.trim());
    formData.append("seriesId", seriesId);

    // Use XHR for upload progress tracking
    const result = await new Promise<{ videoId?: string; error?: string }>(
      (resolve) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 95));
          }
        });

        xhr.addEventListener("load", () => {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve(data);
          } catch {
            resolve({ error: "Invalid server response" });
          }
        });

        xhr.addEventListener("error", () => resolve({ error: "Network error during upload" }));
        xhr.addEventListener("abort", () => resolve({ error: "Upload cancelled" }));

        xhr.open("POST", "/api/videos/upload");
        xhr.send(formData);
      }
    );

    setUploading(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    setProgress(100);
    toast.success("Video uploaded successfully!");
    setOpen(false);
    router.push(`/videos/${result.videoId}`);
    router.refresh();
  }

  return (
    <>
      <button onClick={handleOpen} className="btn-ghost gap-2 text-sm">
        <UploadCloud className="h-4 w-4" />
        Upload Video
      </button>

      <Dialog open={open} onOpenChange={(v) => { if (!uploading) setOpen(v); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Video</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* File drop zone */}
            <div
              className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors
                ${file ? "border-primary/50 bg-primary/5" : "border-muted-foreground/30 hover:border-primary/40 hover:bg-secondary/40"}`}
              onClick={() => !uploading && fileRef.current?.click()}
            >
              <input
                ref={fileRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleFileChange}
                disabled={uploading}
              />
              {file ? (
                <div className="space-y-1">
                  <Film className="w-8 h-8 mx-auto text-primary" />
                  <p className="font-medium text-sm">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                  {!uploading && (
                    <button
                      className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
                      onClick={(e) => { e.stopPropagation(); setFile(null); }}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <UploadCloud className="w-8 h-8 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Click to select a video file
                  </p>
                  <p className="text-xs text-muted-foreground">MP4, MOV, AVI, MKV — up to 2 GB</p>
                </div>
              )}
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="upload-title">Video Title</Label>
              <Input
                id="upload-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter a title for this video"
                disabled={uploading}
              />
            </div>

            {uploading && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Uploading…</span><span>{progress}%</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            <button className="btn-primary w-full justify-center" onClick={handleUpload} disabled={!file || !title.trim() || uploading}>
              {uploading ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</> : <><UploadCloud className="h-4 w-4" /> Upload Video</>}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
