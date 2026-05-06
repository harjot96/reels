"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Music2, Play, Pause, Download, TrendingUp, Search,
  ChevronLeft, ChevronRight, Loader2, Clock, Heart,
  CheckCircle2, Layers, X, Zap,
} from "lucide-react";

interface Track {
  id: string;
  title: string;
  artist: string;
  audioUrl: string;
  duration: number;
  tags: string[];
  likes: number;
  downloads: number;
  avatarUrl: string | null;
}

interface Series {
  id: string;
  title: string;
  bgMusicUrl: string | null;
}

const CATEGORIES = [
  { id: "trending",     label: "Trending",     icon: "🔥" },
  { id: "beats",        label: "Beats",         icon: "🎵" },
  { id: "cinematic",    label: "Cinematic",     icon: "🎬" },
  { id: "ambient",      label: "Ambient",       icon: "🌊" },
  { id: "electronic",   label: "Electronic",    icon: "⚡" },
  { id: "acoustic",     label: "Acoustic",      icon: "🎸" },
  { id: "jazz",         label: "Jazz",          icon: "🎷" },
  { id: "motivational", label: "Motivational",  icon: "🚀" },
  { id: "dark",         label: "Dark",          icon: "🌑" },
  { id: "pop",          label: "Pop",           icon: "🎤" },
];

function fmtDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export default function MusicPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("trending");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [demoMode, setDemoMode] = useState(false);

  // Player state
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioLoading, setAudioLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Apply-to-series modal
  const [applyModalTrack, setApplyModalTrack] = useState<Track | null>(null);
  const [series, setSeries] = useState<Series[]>([]);
  const [loadingSeries, setLoadingSeries] = useState(false);
  const [applyingSeriesId, setApplyingSeriesId] = useState<string | null>(null);
  const [appliedSeriesIds, setAppliedSeriesIds] = useState<Set<string>>(new Set());

  const fetchTracks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/music/trending?category=${category}&page=${page}`);
      const data = await res.json();
      setTracks(data.tracks ?? []);
      setDemoMode(data.demo ?? false);
    } catch {
      toast.error("Failed to load tracks");
    } finally {
      setLoading(false);
    }
  }, [category, page]);

  useEffect(() => { fetchTracks(); }, [fetchTracks]);

  // Reset page on category change
  useEffect(() => { setPage(1); }, [category]);

  // Audio player events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onDuration = () => setDuration(audio.duration);
    const onEnded = () => { setPlayingId(null); setCurrentTime(0); };
    const onWaiting = () => setAudioLoading(true);
    const onCanPlay = () => setAudioLoading(false);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("durationchange", onDuration);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("canplay", onCanPlay);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("durationchange", onDuration);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("canplay", onCanPlay);
    };
  }, []);

  function togglePlay(track: Track) {
    if (!track.audioUrl) { toast.error("Add PIXABAY_API_KEY to preview tracks"); return; }
    const audio = audioRef.current;
    if (!audio) return;

    if (playingId === track.id) {
      audio.pause();
      setPlayingId(null);
    } else {
      if (playingId) audio.pause();
      audio.src = track.audioUrl;
      audio.currentTime = 0;
      setCurrentTime(0);
      setAudioLoading(true);
      audio.play().then(() => {
        setPlayingId(track.id);
        setAudioLoading(false);
      }).catch(() => {
        setAudioLoading(false);
        toast.error("Could not play track");
      });
    }
  }

  function seek(e: React.MouseEvent<HTMLDivElement>, trackDuration: number) {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const t = ratio * trackDuration;
    if (audioRef.current) audioRef.current.currentTime = t;
    setCurrentTime(t);
  }

  async function openApplyModal(track: Track) {
    setApplyModalTrack(track);
    setLoadingSeries(true);
    try {
      const res = await fetch("/api/series");
      const data = await res.json();
      setSeries(data.series ?? data ?? []);
    } catch { toast.error("Failed to load series"); }
    finally { setLoadingSeries(false); }
  }

  async function applyToSeries(seriesId: string) {
    if (!applyModalTrack?.audioUrl) { toast.error("No audio URL — add PIXABAY_API_KEY"); return; }
    setApplyingSeriesId(seriesId);
    try {
      const res = await fetch("/api/music/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seriesId,
          audioUrl: applyModalTrack.audioUrl,
          trackTitle: applyModalTrack.title,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAppliedSeriesIds((prev) => new Set([...prev, seriesId]));
      toast.success(`"${applyModalTrack.title}" set as BG music!`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setApplyingSeriesId(null);
    }
  }

  const filtered = search.trim()
    ? tracks.filter((t) =>
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        t.artist.toLowerCase().includes(search.toLowerCase()) ||
        t.tags.some((tg) => tg.toLowerCase().includes(search.toLowerCase()))
      )
    : tracks;

  const playingTrack = tracks.find((t) => t.id === playingId) ?? null;
  const progressPercent = playingTrack && duration > 0
    ? (currentTime / duration) * 100
    : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hidden audio element */}
      <audio ref={audioRef} preload="auto" />

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Music2 className="h-6 w-6 text-primary" />
            Trending Audio
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Royalty-free tracks — preview and apply to any series as background music
          </p>
        </div>
        {demoMode && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs">
            <Zap className="h-3.5 w-3.5 shrink-0" />
            Demo mode — add <code className="font-mono mx-1">PIXABAY_API_KEY</code> to enable live tracks
          </div>
        )}
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              category === cat.id
                ? "bg-primary text-white shadow-sm"
                : "bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            <span className="text-base leading-none">{cat.icon}</span>
            {cat.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tracks, artists, tags…"
          className="field-input pl-9 py-2"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Track list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton h-[76px] rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Music2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>No tracks found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((track, idx) => {
            const isPlaying = playingId === track.id;
            const isLoading = isPlaying && audioLoading;
            const prog = isPlaying && duration > 0 ? (currentTime / duration) * 100 : 0;

            return (
              <div
                key={track.id}
                className={`rounded-xl border transition-all duration-150 ${
                  isPlaying
                    ? "border-primary/40 bg-primary/5"
                    : "border-border bg-card hover:border-border/80 hover:bg-card/80"
                }`}
              >
                <div className="flex items-center gap-3 p-3">
                  {/* Index / play */}
                  <button
                    onClick={() => togglePlay(track)}
                    className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                      isPlaying ? "bg-primary text-white" : "bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isPlaying ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4 ml-0.5" />
                    )}
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold truncate max-w-[200px]">{track.title}</span>
                      <span className="text-[10px] text-muted-foreground">by {track.artist}</span>
                      {track.tags.slice(0, 2).map((tag) => (
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary/60 text-muted-foreground">{tag}</span>
                      ))}
                    </div>

                    {/* Waveform / progress bar */}
                    {isPlaying ? (
                      <div
                        className="mt-2 h-1.5 rounded-full bg-primary/20 cursor-pointer"
                        onClick={(e) => seek(e, duration)}
                      >
                        <div
                          className="h-full rounded-full bg-primary transition-none"
                          style={{ width: `${prog}%` }}
                        />
                      </div>
                    ) : (
                      <div className="mt-2 flex gap-0.5 items-end h-4">
                        {Array.from({ length: 40 }).map((_, i) => {
                          const h = 20 + Math.sin((i + idx * 7) * 0.7) * 15 + Math.cos((i + idx * 3) * 1.1) * 10;
                          return (
                            <div
                              key={i}
                              className="flex-1 rounded-full bg-border/60"
                              style={{ height: `${Math.max(15, Math.min(100, h))}%` }}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Stats + duration */}
                  <div className="hidden sm:flex flex-col items-end gap-1 shrink-0 text-xs text-muted-foreground">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{fmtCount(track.likes)}</span>
                      <span className="flex items-center gap-1"><Download className="h-3 w-3" />{fmtCount(track.downloads)}</span>
                    </div>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{fmtDuration(track.duration)}</span>
                  </div>

                  {/* Time when playing */}
                  {isPlaying && (
                    <span className="hidden sm:block text-xs font-mono text-primary tabular-nums shrink-0 ml-1">
                      {fmtDuration(Math.floor(currentTime))} / {fmtDuration(track.duration)}
                    </span>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {track.audioUrl && (
                      <a
                        href={track.audioUrl}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-ghost text-xs py-1.5 px-2 gap-1"
                        title="Download"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Download</span>
                      </a>
                    )}
                    <button
                      onClick={() => openApplyModal(track)}
                      className="btn-primary text-xs py-1.5 px-2.5 gap-1"
                    >
                      <Layers className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Use in Series</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!loading && !search && filtered.length > 0 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-ghost gap-1 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </button>
          <span className="text-sm text-muted-foreground px-2">Page {page}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={filtered.length < 20}
            className="btn-ghost gap-1 disabled:opacity-40"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Now playing bar */}
      {playingTrack && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl border border-primary/30 bg-card/90 backdrop-blur-md shadow-xl max-w-lg w-[calc(100%-2rem)] animate-fade-in-scale">
          <button
            onClick={() => togglePlay(playingTrack)}
            className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center shrink-0"
          >
            {audioLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />}
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{playingTrack.title}</p>
            <div
              className="mt-1 h-1 rounded-full bg-secondary cursor-pointer"
              onClick={(e) => seek(e, duration)}
            >
              <div
                className="h-full rounded-full bg-primary transition-none"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
          <span className="text-xs font-mono text-muted-foreground tabular-nums shrink-0">
            {fmtDuration(Math.floor(currentTime))} / {fmtDuration(playingTrack.duration)}
          </span>
          <button
            onClick={() => { audioRef.current?.pause(); setPlayingId(null); }}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Apply to series modal */}
      {applyModalTrack && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setApplyModalTrack(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl animate-fade-in-scale">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold">Use in Series</h3>
                <p className="text-sm text-muted-foreground mt-0.5 truncate max-w-[220px]">
                  "{applyModalTrack.title}"
                </p>
              </div>
              <button onClick={() => setApplyModalTrack(null)} className="text-muted-foreground hover:text-foreground transition-colors mt-0.5">
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground mb-4">
              Select a series to set this as background music. It will replace any existing BG music.
            </p>

            {loadingSeries ? (
              <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading series…
              </div>
            ) : series.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No series found. Create one first.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {series.map((s) => {
                  const applied = appliedSeriesIds.has(s.id);
                  const isApplying = applyingSeriesId === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => !applied && applyToSeries(s.id)}
                      disabled={isApplying || applied}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm transition-all ${
                        applied
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "border-border hover:border-primary/40 hover:bg-secondary/60 text-foreground"
                      }`}
                    >
                      <span className="font-medium truncate text-left flex-1 mr-2">{s.title}</span>
                      {isApplying ? (
                        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                      ) : applied ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                      ) : (
                        <TrendingUp className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
