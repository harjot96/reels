"use client";
import { useEffect, useRef, useState } from "react";
import { Radio, Tv2, StopCircle, ExternalLink, Loader2, ThumbsUp, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

interface VideoOption { id: string; title: string; videoUrl: string | null; status: string }
interface LiveStream {
  id: string;
  title: string;
  status: string; // STARTING | LIVE | ENDING | ENDED | FAILED
  platforms: string; // JSON
  youtubeWatchUrl?: string;
  facebookPermalink?: string;
  errorMessage?: string;
  startedAt: string;
  endedAt?: string;
}

const STATUS_COLOR: Record<string, string> = {
  STARTING: "text-amber-400",
  LIVE:     "text-green-400",
  ENDING:   "text-amber-400",
  ENDED:    "text-muted-foreground",
  FAILED:   "text-destructive",
};

const STATUS_DOT: Record<string, string> = {
  STARTING: "bg-amber-400 animate-pulse",
  LIVE:     "bg-green-400 animate-pulse",
  ENDING:   "bg-amber-400",
  ENDED:    "bg-muted-foreground",
  FAILED:   "bg-destructive",
};

export default function LivePage() {
  const [videos, setVideos] = useState<VideoOption[]>([]);
  const [selectedVideo, setSelectedVideo] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [platforms, setPlatforms] = useState<Set<"youtube" | "facebook">>(new Set(["youtube", "facebook"]));
  const [starting, setStarting] = useState(false);
  const [activeStream, setActiveStream] = useState<LiveStream | null>(null);
  const [stopping, setStopping] = useState(false);
  const [history, setHistory] = useState<LiveStream[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load ready videos
  useEffect(() => {
    fetch("/api/videos?status=READY&limit=100")
      .then((r) => r.json())
      .then((d) => setVideos(Array.isArray(d) ? d : d.videos ?? []));
    fetchHistory();
  }, []);

  async function fetchHistory() {
    const res = await fetch("/api/livestream");
    if (res.ok) {
      const all: LiveStream[] = await res.json();
      // Active = STARTING or LIVE or ENDING
      const active = all.find((s) => ["STARTING", "LIVE", "ENDING"].includes(s.status));
      setActiveStream(active ?? null);
      setHistory(all.filter((s) => s.status === "ENDED" || s.status === "FAILED").slice(0, 10));
      if (active) startPolling(active.id);
    }
  }

  function startPolling(streamId: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/livestream/${streamId}`);
      if (!res.ok) return;
      const s: LiveStream = await res.json();
      setActiveStream(s);
      if (s.status === "ENDED" || s.status === "FAILED") {
        clearInterval(pollRef.current!);
        pollRef.current = null;
        setActiveStream(null);
        fetchHistory();
        if (s.status === "FAILED") toast.error(`Stream failed: ${s.errorMessage ?? "Unknown error"}`);
        else toast.success("Live stream ended");
      }
    }, 3000);
  }

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  function togglePlatform(p: "youtube" | "facebook") {
    setPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p); else next.add(p);
      return next;
    });
  }

  async function handleStart() {
    if (!selectedVideo) return toast.error("Select a video first");
    if (!title.trim()) return toast.error("Enter a stream title");
    if (!platforms.size) return toast.error("Select at least one platform");

    setStarting(true);
    try {
      const res = await fetch("/api/livestream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId: selectedVideo,
          title: title.trim(),
          description: description.trim(),
          platforms: Array.from(platforms),
        }),
      });
      const text = await res.text();
      let data: any = {};
      try { data = text ? JSON.parse(text) : {}; } catch { /* non-JSON */ }
      if (!res.ok) throw new Error(data.error || `Failed to start stream (${res.status}): ${text.slice(0, 200)}`);

      toast.success("Stream starting… this may take ~15 seconds");
      const stream: LiveStream = { id: data.streamId, title, status: "STARTING", platforms: JSON.stringify(Array.from(platforms)), startedAt: new Date().toISOString() };
      setActiveStream(stream);
      startPolling(data.streamId);
    } catch (err: any) {
      toast.error(err.message || "Failed to start stream");
    } finally {
      setStarting(false);
    }
  }

  async function handleStop() {
    if (!activeStream) return;
    setStopping(true);
    try {
      const res = await fetch(`/api/livestream/${activeStream.id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to stop stream");
      }
      toast.success("Stream stopped");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setStopping(false);
    }
  }

  const activePlatforms: string[] = activeStream ? JSON.parse(activeStream.platforms) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Radio className="w-6 h-6 text-red-500" />
          Go Live
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Stream any video on loop to YouTube and / or Facebook until you stop it.
        </p>
      </div>

      {/* Active stream banner */}
      {activeStream && (
        <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-4 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_DOT[activeStream.status]}`} />
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${STATUS_COLOR[activeStream.status]}`}>
                  {activeStream.status === "STARTING" ? "Setting up stream…" :
                   activeStream.status === "LIVE"     ? "🔴 Live now" :
                   activeStream.status === "ENDING"   ? "Ending stream…" : activeStream.status}
                </p>
                <p className="text-xs text-muted-foreground truncate">{activeStream.title}</p>
              </div>
            </div>
            <button
              onClick={handleStop}
              disabled={stopping || activeStream.status === "ENDING"}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/20 text-destructive text-xs font-semibold hover:bg-destructive/30 transition-colors disabled:opacity-50 shrink-0"
            >
              {stopping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <StopCircle className="w-3.5 h-3.5" />}
              Stop Stream
            </button>
          </div>

          {/* Platform links */}
          <div className="flex flex-wrap gap-2">
            {activePlatforms.includes("youtube") && activeStream.youtubeWatchUrl && (
              <a href={activeStream.youtubeWatchUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors">
                <Tv2 className="w-3.5 h-3.5" />
                Watch on YouTube
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {activePlatforms.includes("facebook") && activeStream.facebookPermalink && (
              <a href={activeStream.facebookPermalink} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                <ThumbsUp className="w-3.5 h-3.5" />
                Watch on Facebook
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Setup form — hidden while a stream is active */}
      {!activeStream && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: setup */}
          <div className="space-y-4 rounded-xl border border-border bg-card p-5">
            <p className="text-sm font-semibold">Stream Setup</p>

            {/* Video picker */}
            <div>
              <label className="text-xs text-muted-foreground">Video (streams on loop)</label>
              <select
                className="mt-1 w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                value={selectedVideo}
                onChange={(e) => {
                  setSelectedVideo(e.target.value);
                  const v = videos.find((x) => x.id === e.target.value);
                  if (v && !title) setTitle(v.title);
                }}
              >
                <option value="">Select a video…</option>
                {videos.map((v) => (
                  <option key={v.id} value={v.id}>{v.title}</option>
                ))}
              </select>
            </div>

            {/* Title */}
            <div>
              <label className="text-xs text-muted-foreground">Stream Title</label>
              <input
                className="mt-1 w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter live stream title…"
                maxLength={100}
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-xs text-muted-foreground">Description (optional)</label>
              <textarea
                className="mt-1 w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary resize-none"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Stream description…"
              />
            </div>

            {/* Platforms */}
            <div>
              <label className="text-xs text-muted-foreground">Platforms</label>
              <div className="mt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => togglePlatform("youtube")}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    platforms.has("youtube")
                      ? "border-red-500 bg-red-500/10 text-red-400"
                      : "border-border text-muted-foreground hover:border-red-500/50"
                  }`}
                >
                  <Tv2 className="w-4 h-4" /> YouTube
                </button>
                <button
                  type="button"
                  onClick={() => togglePlatform("facebook")}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    platforms.has("facebook")
                      ? "border-blue-500 bg-blue-500/10 text-blue-400"
                      : "border-border text-muted-foreground hover:border-blue-500/50"
                  }`}
                >
                  <ThumbsUp className="w-4 h-4" /> Facebook
                </button>
              </div>
            </div>

            <button
              onClick={handleStart}
              disabled={starting || !selectedVideo || !title.trim() || !platforms.size}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {starting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Starting…</>
                : <><Radio className="w-4 h-4" /> Go Live</>}
            </button>
          </div>

          {/* Right: info */}
          <div className="space-y-3 rounded-xl border border-border bg-card/50 p-5 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">How it works</p>
            <ul className="space-y-2 text-xs">
              <li className="flex gap-2"><span className="text-primary shrink-0">1.</span> Select a ready video — it will loop indefinitely as the live stream source.</li>
              <li className="flex gap-2"><span className="text-primary shrink-0">2.</span> Choose YouTube, Facebook, or both. Both platforms go live simultaneously.</li>
              <li className="flex gap-2"><span className="text-primary shrink-0">3.</span> Click <strong className="text-foreground">Go Live</strong>. It takes ~15 seconds to set up the broadcast and start sending video.</li>
              <li className="flex gap-2"><span className="text-primary shrink-0">4.</span> Click <strong className="text-foreground">Stop Stream</strong> when you want to end the broadcast.</li>
            </ul>
            <div className="border-t border-border pt-3 space-y-1">
              <p className="text-[11px]"><span className="text-amber-400">⚠</span> YouTube requires the channel to have live streaming enabled.</p>
              <p className="text-[11px]"><span className="text-amber-400">⚠</span> Facebook requires a connected Page with publish permissions.</p>
              <p className="text-[11px]"><span className="text-amber-400">⚠</span> The stream runs as long as this server is running.</p>
            </div>
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">Past Streams</p>
          <div className="space-y-2">
            {history.map((s) => {
              const ps: string[] = JSON.parse(s.platforms);
              const duration = s.endedAt
                ? Math.round((new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 60000)
                : null;
              return (
                <div key={s.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
                  {s.status === "ENDED"
                    ? <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                    : <XCircle className="w-4 h-4 text-destructive shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{s.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {ps.join(" + ")}
                      {duration !== null ? ` · ${duration}m` : ""}
                      {s.errorMessage ? ` · ${s.errorMessage}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {s.youtubeWatchUrl && (
                      <a href={s.youtubeWatchUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-red-400">
                        <Tv2 className="w-4 h-4" />
                      </a>
                    )}
                    {s.facebookPermalink && (
                      <a href={s.facebookPermalink} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-blue-400">
                        <ThumbsUp className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
