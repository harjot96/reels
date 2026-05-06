"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Music, Upload, Loader2, ExternalLink, CheckCircle } from "lucide-react";

interface Props {
  seriesId?: string;
  seriesLogoUrl?: string | null;
}

export function AudioToVideoButton({ seriesId, seriesLogoUrl }: Props) {
  const [open, setOpen] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [videoFormat, setVideoFormat] = useState("landscape");
  const [publishToYoutube, setPublishToYoutube] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<{ videoId: string; youtubeUrl?: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function reset() {
    setAudioFile(null);
    setLogoFile(null);
    setTitle("");
    setDescription("");
    setVideoFormat("landscape");
    setPublishToYoutube(false);
    setDone(null);
    setLoading(false);
  }

  function handleClose() {
    if (loading) return;
    setOpen(false);
    reset();
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setAudioFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "));
  }

  function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setLogoFile(f);
  }

  async function handleSubmit() {
    if (!audioFile || !title.trim()) return;
    setLoading(true);

    const fd = new FormData();
    fd.append("audio", audioFile);
    fd.append("title", title.trim());
    fd.append("description", description.trim());
    fd.append("videoFormat", videoFormat);
    fd.append("publishToYoutube", publishToYoutube ? "1" : "0");
    if (logoFile) fd.append("logo", logoFile);
    if (seriesId) fd.append("seriesId", seriesId);

    try {
      const res = await fetch("/api/audio-to-video", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setDone({ videoId: data.videoId, youtubeUrl: data.youtubeUrl });
      toast.success(data.youtubeUrl ? "Uploaded to YouTube!" : "Video created!");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-ghost gap-2">
        <Music className="h-4 w-4" /> MP3 to Video
      </button>

      <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Music className="h-5 w-5 text-primary" /> MP3 to Video
            </DialogTitle>
            <DialogDescription>
              Upload an audio file — it gets converted to a video
              {seriesLogoUrl ? " with your channel logo" : ""} and optionally published to YouTube.
            </DialogDescription>
          </DialogHeader>

          {done ? (
            <div className="space-y-4 py-2">
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <CheckCircle className="h-10 w-10 text-green-500" />
                <p className="font-medium">Video created!</p>
                {done.youtubeUrl && (
                  <a href={done.youtubeUrl} target="_blank" rel="noopener noreferrer"
                    className="text-sm text-primary underline flex items-center gap-1">
                    <ExternalLink className="h-4 w-4" /> View on YouTube
                  </a>
                )}
              </div>
              <div className="flex gap-2">
                <button className="btn-ghost flex-1 justify-center" onClick={() => router.push(`/videos/${done.videoId}`)}>
                  View Video
                </button>
                <button className="btn-primary flex-1 justify-center" onClick={() => { reset(); }}>
                  Convert Another
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {/* Audio file */}
              <div className="space-y-2">
                <Label>Audio File</Label>
                <input ref={fileRef} type="file" accept="audio/*,.mp3,.m4a,.wav,.aac,.mp4" className="hidden" onChange={handleFile} />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className={`w-full border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
                    audioFile ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                  }`}
                >
                  {audioFile ? (
                    <div className="flex items-center justify-center gap-2">
                      <Music className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium truncate max-w-[200px]">{audioFile.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({(audioFile.size / 1024 / 1024).toFixed(1)} MB)
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <Upload className="h-6 w-6 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Click to select MP3, WAV, M4A...</span>
                    </div>
                  )}
                </button>
              </div>

              {/* Logo file (optional) */}
              <div className="space-y-2">
                <Label>Logo <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogoFile} />
                <button
                  type="button"
                  onClick={() => logoRef.current?.click()}
                  className={`w-full border-2 border-dashed rounded-lg p-3 text-center transition-colors ${
                    logoFile ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                  }`}
                >
                  {logoFile ? (
                    <div className="flex items-center justify-center gap-2">
                      <Upload className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium truncate max-w-[220px]">{logoFile.name}</span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">Click to upload PNG/JPG logo</span>
                  )}
                </button>
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label>Video Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enter video title" />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label>Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="YouTube description..."
                  rows={2}
                />
              </div>

              {/* Video format */}
              <div className="space-y-2">
                <Label>Video Format</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "landscape", label: "Landscape", icon: "▭" },
                    { value: "shorts", label: "Shorts", icon: "▯" },
                    { value: "square", label: "Square", icon: "□" },
                  ].map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setVideoFormat(f.value)}
                      className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 text-xs transition-colors ${
                        videoFormat === f.value ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40"
                      }`}
                    >
                      <span className="text-lg">{f.icon}</span>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Publish toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-2">
                  <ExternalLink className="h-4 w-4 text-red-500" />
                  <div>
                    <p className="text-sm font-medium">Upload to YouTube</p>
                    <p className="text-xs text-muted-foreground">Publish immediately after conversion</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPublishToYoutube(!publishToYoutube)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${publishToYoutube ? "bg-primary" : "bg-secondary"}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${publishToYoutube ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>

              {(logoFile || seriesLogoUrl) && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  {logoFile ? (
                    <>Uploaded logo will be added to the video ({logoFile.name})</>
                  ) : (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={seriesLogoUrl || ""} alt="" className="h-4 w-4 rounded object-contain" />
                      Channel logo will be added to the video
                    </>
                  )}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button className="btn-ghost flex-1 justify-center" onClick={handleClose}>Cancel</button>
                <button
                  className="btn-primary flex-1 justify-center"
                  disabled={!audioFile || !title.trim() || loading}
                  onClick={handleSubmit}
                >
                  {loading ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Converting...</>
                  ) : (
                    <><Music className="h-4 w-4 mr-2" /> Convert &amp; {publishToYoutube ? "Publish" : "Save"}</>
                  )}
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
