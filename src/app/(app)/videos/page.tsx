"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Video as VideoIcon, ExternalLink, StopCircle, Trash2, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import type { Video } from "@/types";

const STATUSES = ["ALL", "GENERATING", "READY", "SCHEDULED", "PUBLISHED", "FAILED"];

const statusClass: Record<string, string> = {
  PUBLISHED: "status-pill status-pill-published",
  READY:     "status-pill status-pill-ready",
  GENERATING:"status-pill status-pill-generating",
  SCHEDULED: "status-pill status-pill-scheduled",
  FAILED:    "status-pill status-pill-failed",
  PENDING:   "status-pill status-pill-pending",
};

export default function VideosPage() {
  const [status, setStatus] = useState("ALL");
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const fetchVideos = useCallback(() => {
    const url = status === "ALL" ? "/api/videos" : `/api/videos?status=${status}`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => { setVideos(data); setLoading(false); });
  }, [status]);

  useEffect(() => { setLoading(true); fetchVideos(); }, [fetchVideos]);

  useEffect(() => {
    const hasGenerating = videos.some((v: any) => v.status === "GENERATING" || v.status === "PENDING");
    if (!hasGenerating) return;
    const timer = setInterval(fetchVideos, 3000);
    return () => clearInterval(timer);
  }, [videos, fetchVideos]);

  async function handleCancel(videoId: string, e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    setActionLoading(videoId + "_cancel");
    const res = await fetch(`/api/videos/${videoId}/cancel`, { method: "POST" });
    setActionLoading(null);
    if (res.ok) { toast.success("Generation cancelled."); fetchVideos(); }
    else toast.error("Failed to cancel.");
  }

  async function handleDelete(videoId: string, e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (!confirm("Delete this video? This cannot be undone.")) return;
    setActionLoading(videoId + "_delete");
    const res = await fetch(`/api/videos/${videoId}`, { method: "DELETE" });
    setActionLoading(null);
    if (res.ok) { toast.success("Video deleted."); setVideos((prev) => prev.filter((v: any) => v.id !== videoId)); }
    else toast.error("Failed to delete.");
  }

  const filtered = videos.filter((v: any) =>
    !search || v.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Videos</h1>
          <p className="text-muted-foreground mt-1 text-sm">{videos.length} video{videos.length !== 1 ? "s" : ""} total</p>
        </div>
      </div>

      {/* Filters row */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search videos…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-sm bg-secondary/50 border border-border rounded-lg outline-none focus:border-primary w-48 transition-colors"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                status === s
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 border rounded-xl bg-card/50 text-center">
          <div className="w-16 h-16 rounded-2xl bg-secondary/60 flex items-center justify-center mb-4">
            <VideoIcon className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <p className="font-semibold">No videos found</p>
          <p className="text-sm text-muted-foreground mt-1">
            {search ? "Try a different search term" : "Generate a video from a series to get started"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((video: any) => {
            const isGenerating = video.status === "GENERATING" || video.status === "PENDING";
            const isCancelling = actionLoading === video.id + "_cancel";
            const isDeleting  = actionLoading === video.id + "_delete";
            const progress = video.job?.overallProgress ?? 0;

            return (
              <div key={video.id}
                className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-secondary/30 hover:border-border/80 transition-all duration-150 group">
                {/* Thumbnail */}
                <div className="w-14 h-10 rounded-lg bg-secondary/70 flex items-center justify-center shrink-0 overflow-hidden border border-border/50">
                  {video.thumbnailUrl
                    ? <img src={video.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                    : <VideoIcon className="h-4 w-4 text-muted-foreground/40" />}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <Link href={`/videos/${video.id}`}
                    className="font-medium text-sm hover:text-primary transition-colors truncate block">
                    {video.title}
                  </Link>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {video.series?.title}
                    {video.durationSeconds ? ` · ${Math.floor(video.durationSeconds / 60)}m ${video.durationSeconds % 60}s` : ""}
                    {" · "}{formatDistanceToNow(new Date(video.createdAt), { addSuffix: true })}
                  </p>
                  {isGenerating && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="progress-bar flex-1 max-w-[140px]">
                        <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                      </div>
                      <span className="text-[10px] text-primary shrink-0">
                        {video.job?.stepMessage || "Generating…"} {progress}%
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {video.youtubeUrl && (
                    <a href={video.youtubeUrl} target="_blank" rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  <span className={statusClass[video.status] ?? "status-pill status-pill-pending"}>
                    {isGenerating && <span className="live-dot" />}
                    {video.status.toLowerCase()}
                  </span>
                  {isGenerating ? (
                    <button onClick={(e) => handleCancel(video.id, e)} disabled={!!actionLoading}
                      className="p-1.5 rounded-md text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50">
                      {isCancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <StopCircle className="h-4 w-4" />}
                    </button>
                  ) : (
                    <button onClick={(e) => handleDelete(video.id, e)} disabled={!!actionLoading}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50 opacity-0 group-hover:opacity-100">
                      {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
