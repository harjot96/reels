"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Trash2, Upload, X, ImageIcon, Music, Loader2 } from "lucide-react";

export default function SeriesSettingsPage() {
  const router = useRouter();
  const params = useParams<{ seriesId: string }>();
  const [loading, setLoading] = useState(false);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    niche: "",
    description: "",
    language: "en",
    videoFormat: "landscape",
    videoDuration: 60,
    autoPublish: false,
    publishSchedule: "",
  });
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [bgMusicUrl, setBgMusicUrl] = useState<string | null>(null);
  const [bgMusicVolume, setBgMusicVolume] = useState(0.12);
  const logoRef = useRef<HTMLInputElement>(null);
  const musicRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/series/${params.seriesId}`)
      .then((r) => r.json())
      .then((data) => {
        setForm({
          title: data.title,
          niche: data.niche,
          description: data.description || "",
          language: data.language || "en",
          videoFormat: data.videoFormat || "landscape",
          videoDuration: data.videoDuration,
          autoPublish: data.autoPublish,
          publishSchedule: data.publishSchedule || "",
        });
        setLogoUrl(data.logoUrl || null);
        setBgMusicUrl(data.bgMusicUrl || null);
        setBgMusicVolume(data.bgMusicVolume ?? 0.12);
      });
  }, [params.seriesId]);

  async function uploadAsset(fieldName: string, file: File | null, extra?: Record<string, string>) {
    setAssetsLoading(true);
    try {
      const fd = new FormData();
      if (file) fd.append(fieldName, file);
      if (extra) Object.entries(extra).forEach(([k, v]) => fd.append(k, v));
      const res = await fetch(`/api/series/${params.seriesId}/assets`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.logoUrl !== undefined) setLogoUrl(data.logoUrl);
      if (data.bgMusicUrl !== undefined) setBgMusicUrl(data.bgMusicUrl);
      if (data.bgMusicVolume !== undefined) setBgMusicVolume(data.bgMusicVolume);
      toast.success("Saved!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setAssetsLoading(false);
    }
  }

  const update = (field: string, value: string | number | boolean | null) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  async function handleSave() {
    setLoading(true);
    const res = await fetch(`/api/series/${params.seriesId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setLoading(false);
    if (res.ok) toast.success("Settings saved");
    else toast.error("Failed to save");
  }

  async function handleDelete() {
    if (!confirm("Archive this series? This will not delete existing videos.")) return;
    await fetch(`/api/series/${params.seriesId}`, { method: "DELETE" });
    router.push("/series");
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="btn-ghost gap-1.5 text-sm">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <h1 className="page-title">Series Settings</h1>
      </div>

      {/* Channel Logo */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-primary" />
          <span className="font-semibold">Channel Logo</span>
        </div>
        <p className="text-sm text-muted-foreground">PNG/JPG — stamped on the top-right corner of every generated video.</p>
        <div className="flex items-center gap-4">
          {logoUrl ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt="Channel logo" className="h-16 w-16 rounded-lg object-contain border border-border bg-secondary" />
              <button
                onClick={() => uploadAsset("clearLogo", null, { clearLogo: "1" })}
                className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="h-16 w-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center">
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
          <div className="space-y-1">
            <input ref={logoRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAsset("logo", f); }} />
            <button
              className="btn-ghost text-sm gap-1.5"
              disabled={assetsLoading}
              onClick={() => logoRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" />
              {assetsLoading ? "Uploading…" : logoUrl ? "Replace Logo" : "Upload Logo"}
            </button>
            <p className="text-xs text-muted-foreground">PNG with transparent background works best</p>
          </div>
        </div>
      </div>

      {/* Background Music */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Music className="h-4 w-4 text-primary" />
          <span className="font-semibold">Background Music</span>
        </div>
        <p className="text-sm text-muted-foreground">Upload an MP3 or MP4 file — mixed quietly under the voiceover in every video.</p>
        <div className="space-y-3">
          {bgMusicUrl ? (
            <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-secondary/30">
              <Music className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm truncate flex-1">{bgMusicUrl.split("/").pop()}</span>
              <button
                onClick={() => uploadAsset("clearBgMusic", null, { clearBgMusic: "1" })}
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="p-3 rounded-lg border-2 border-dashed border-border text-center">
              <p className="text-sm text-muted-foreground">No background music set</p>
            </div>
          )}
          <input ref={musicRef} type="file" accept="audio/*,video/mp4" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAsset("bgMusic", f); }} />
          <button
            className="btn-ghost text-sm gap-1.5"
            disabled={assetsLoading}
            onClick={() => musicRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" />
            {assetsLoading ? "Uploading…" : bgMusicUrl ? "Replace Music" : "Upload Music"}
          </button>
          <div className="space-y-1.5">
            <Label className="text-sm">Volume: {Math.round(bgMusicVolume * 100)}%</Label>
            <input
              type="range" min={0} max={0.5} step={0.01}
              value={bgMusicVolume}
              onChange={(e) => setBgMusicVolume(parseFloat(e.target.value))}
              onMouseUp={(e) => uploadAsset("bgMusicVolumeOnly", null, { bgMusicVolume: String((e.target as HTMLInputElement).value) })}
              className="w-full accent-primary"
            />
            <p className="text-xs text-muted-foreground">5–15% recommended so it doesn&apos;t overpower the voiceover</p>
          </div>
        </div>
      </div>

      {/* Basic Info */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <p className="font-semibold">Basic Info</p>
        <div className="space-y-2">
          <Label>Title</Label>
          <Input value={form.title} onChange={(e) => update("title", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Niche / Topic</Label>
          <Input value={form.niche} onChange={(e) => update("niche", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            rows={3}
          />
        </div>
        <div className="space-y-2">
          <Label>Video Format</Label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: "shorts", label: "Shorts", sub: "9:16 · Vertical", icon: "▯" },
              { value: "landscape", label: "Landscape", sub: "16:9 · Standard", icon: "▭" },
              { value: "square", label: "Square", sub: "1:1 · Instagram", icon: "□" },
            ].map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => update("videoFormat", f.value)}
                className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-colors ${
                  form.videoFormat === f.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <span className="text-2xl">{f.icon}</span>
                <span className="text-sm font-medium">{f.label}</span>
                <span className="text-xs text-muted-foreground">{f.sub}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label>Language</Label>
          <Select value={form.language} onValueChange={(v) => update("language", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="hi">Hindi (हिंदी)</SelectItem>
              <SelectItem value="pa">Punjabi (ਪੰਜਾਬੀ)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Video Duration (seconds)</Label>
          <Select
            value={String(form.videoDuration)}
            onValueChange={(v) => update("videoDuration", Number(v))}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30s — Short (Reels/Shorts)</SelectItem>
              <SelectItem value="60">1 min — Quick</SelectItem>
              <SelectItem value="120">2 min — Short-form</SelectItem>
              <SelectItem value="180">3 min — Standard</SelectItem>
              <SelectItem value="300">5 min — Medium</SelectItem>
              <SelectItem value="600">10 min — Long-form</SelectItem>
              <SelectItem value="900">15 min — Deep dive</SelectItem>
              <SelectItem value="1800">30 min — Full episode</SelectItem>
              <SelectItem value="3600">60 min — Podcast/Lecture</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between p-4 rounded-lg border border-border">
          <div>
            <p className="font-medium">Auto-publish</p>
            <p className="text-sm text-muted-foreground">Auto-upload to YouTube after generation</p>
          </div>
          <button
            type="button"
            onClick={() => update("autoPublish", !form.autoPublish)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.autoPublish ? "bg-primary" : "bg-secondary"}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.autoPublish ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 text-sm text-destructive hover:text-destructive/80 transition-colors px-3 py-1.5 rounded-lg hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" /> Archive Series
          </button>
          <button onClick={handleSave} disabled={loading} className="btn-primary gap-2">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
