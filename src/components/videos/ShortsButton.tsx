"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Scissors, Upload, ExternalLink, Loader2, Clock, CheckCircle2, X, PlayCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Short {
  id: string;
  title: string;
  url: string;
  index: number;
  youtubeUrl: string | null;
}

interface ShortsButtonProps {
  videoId: string;
  videoTitle: string;
  durationSeconds: number;
}

const INTERVAL_OPTIONS = [
  { label: "Immediately (no delay)", value: 0 },
  { label: "5 minutes apart", value: 5 },
  { label: "10 minutes apart", value: 10 },
  { label: "15 minutes apart", value: 15 },
  { label: "30 minutes apart", value: 30 },
  { label: "1 hour apart", value: 60 },
  { label: "2 hours apart", value: 120 },
  { label: "6 hours apart", value: 360 },
  { label: "24 hours apart", value: 1440 },
];

export function ShortsButton({ videoId, videoTitle, durationSeconds }: ShortsButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shorts, setShorts] = useState<Short[]>([]);
  const [publishingIdx, setPublishingIdx] = useState<number | null>(null);

  // Scheduler state
  const [showScheduler, setShowScheduler] = useState(false);
  const [intervalMinutes, setIntervalMinutes] = useState(15);
  const [scheduleRunning, setScheduleRunning] = useState(false);
  const [scheduleQueue, setScheduleQueue] = useState<Short[]>([]);
  const [currentUploadIdx, setCurrentUploadIdx] = useState(0); // index in queue
  const [countdown, setCountdown] = useState(0); // seconds until next upload
  const [completedInSchedule, setCompletedInSchedule] = useState<string[]>([]); // short ids done

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scheduleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (durationSeconds < 60) return null;

  function clearTimers() {
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (scheduleRef.current) clearTimeout(scheduleRef.current);
  }

  // Cleanup on unmount
  useEffect(() => () => clearTimers(), []);

  async function generateShorts(publishToYoutube = false) {
    setLoading(true);
    try {
      const res = await fetch(`/api/videos/${videoId}/shorts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publishToYoutube }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate shorts");
      setShorts(data.shorts);
      toast.success(`${data.shorts.length} Shorts generated!`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error generating shorts");
    } finally {
      setLoading(false);
    }
  }

  async function publishShort(short: Short) {
    setPublishingIdx(short.index);
    try {
      const res = await fetch(`/api/videos/${videoId}/shorts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publishToYoutube: true, shortId: short.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setShorts((prev) => prev.map((s) => {
        const updated = data.shorts?.find((u: Short) => u.id === s.id);
        return updated ?? s;
      }));
      toast.success(`"${short.title}" published!`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setPublishingIdx(null);
    }
  }

  function startScheduledUpload() {
    const queue = shorts.filter((s) => !s.youtubeUrl);
    if (queue.length === 0) { toast.error("All shorts are already published!"); return; }
    setScheduleQueue(queue);
    setCurrentUploadIdx(0);
    setCompletedInSchedule([]);
    setScheduleRunning(true);
    setShowScheduler(false);
    uploadNext(queue, 0, []);
  }

  function uploadNext(queue: Short[], idx: number, done: string[]) {
    if (idx >= queue.length) {
      setScheduleRunning(false);
      setCurrentUploadIdx(queue.length);
      toast.success(`All ${queue.length} Shorts scheduled & published!`);
      clearTimers();
      return;
    }

    const short = queue[idx];
    setCurrentUploadIdx(idx);
    setCountdown(0);

    // Do the upload
    (async () => {
      try {
        const res = await fetch(`/api/videos/${videoId}/shorts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publishToYoutube: true, shortId: short.id }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed");
        const newDone = [...done, short.id];
        setCompletedInSchedule(newDone);
        setShorts((prev) => prev.map((s) => {
          const updated = data.shorts?.find((u: Short) => u.id === s.id);
          return updated ?? s;
        }));
        toast.success(`Uploaded: "${short.title}"`);

        // Schedule next
        const nextIdx = idx + 1;
        if (nextIdx < queue.length) {
          const delayMs = intervalMinutes * 60 * 1000;
          if (delayMs === 0) {
            uploadNext(queue, nextIdx, newDone);
          } else {
            let remaining = intervalMinutes * 60;
            setCountdown(remaining);
            countdownRef.current = setInterval(() => {
              remaining -= 1;
              setCountdown(remaining);
              if (remaining <= 0 && countdownRef.current) {
                clearInterval(countdownRef.current);
              }
            }, 1000);
            scheduleRef.current = setTimeout(() => {
              clearTimers();
              uploadNext(queue, nextIdx, newDone);
            }, delayMs);
          }
        } else {
          uploadNext(queue, nextIdx, newDone);
        }
      } catch (e) {
        toast.error(`Failed to upload "${short.title}": ${e instanceof Error ? e.message : "Error"}`);
        setScheduleRunning(false);
        clearTimers();
      }
    })();
  }

  function cancelSchedule() {
    clearTimers();
    setScheduleRunning(false);
    setShowScheduler(false);
    setCountdown(0);
    toast.info("Scheduled upload cancelled");
  }

  function formatCountdown(secs: number) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  const unpublishedShorts = shorts.filter((s) => !s.youtubeUrl);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary/50 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
      >
        <Scissors className="w-3 h-3" /> Shorts
      </button>

      <Dialog open={open} onOpenChange={(v) => { if (!v && scheduleRunning) { toast.info("Upload schedule still running in background"); } setOpen(v); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scissors className="w-4 h-4 text-primary" /> YouTube Shorts
            </DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            Auto-cut 3 × 55s vertical clips from <span className="font-medium text-foreground">{videoTitle}</span>.
          </p>

          {shorts.length === 0 ? (
            <div className="flex flex-col gap-2 pt-1">
              <button onClick={() => generateShorts(false)} disabled={loading} className="btn-primary justify-center">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Cutting clips…</> : <><Scissors className="w-4 h-4" /> Cut Shorts (local only)</>}
              </button>
              <button onClick={() => generateShorts(true)} disabled={loading} className="btn-ghost justify-center">
                <Upload className="w-4 h-4" /> Cut &amp; Publish All to YouTube
              </button>
            </div>
          ) : (
            <div className="space-y-3 pt-1">

              {/* Schedule running status */}
              {scheduleRunning && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="live-dot" />
                      <span className="text-sm font-semibold text-primary">Scheduled Upload Running</span>
                    </div>
                    <button onClick={cancelSchedule} className="text-muted-foreground hover:text-destructive transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    {scheduleQueue.map((s, i) => {
                      const isDone = completedInSchedule.includes(s.id);
                      const isUploading = i === currentUploadIdx && !isDone;
                      const isPending = i > currentUploadIdx;

                      return (
                        <div key={s.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors ${
                          isDone ? "bg-emerald-500/10" : isUploading ? "bg-amber-500/10" : "bg-secondary/30"
                        }`}>
                          {isDone ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          ) : isUploading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500 shrink-0" />
                          ) : (
                            <Clock className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                          )}
                          <span className={`text-xs flex-1 truncate ${isDone ? "text-emerald-600 dark:text-emerald-400" : isUploading ? "text-amber-600 dark:text-amber-400 font-medium" : "text-muted-foreground"}`}>
                            {s.title}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {isDone ? "Done" : isUploading ? "Uploading…" : isPending && countdown > 0 && i === currentUploadIdx + 1 ? formatCountdown(countdown) : "Queued"}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {countdown > 0 && currentUploadIdx < scheduleQueue.length - 1 && (
                    <div className="text-center space-y-1.5">
                      <p className="text-xs text-muted-foreground">Next upload in</p>
                      <p className="text-2xl font-bold tabular-nums text-primary">{formatCountdown(countdown)}</p>
                      <div className="progress-bar">
                        <div className="progress-bar-fill transition-none" style={{ width: `${100 - (countdown / (intervalMinutes * 60)) * 100}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Shorts list */}
              {shorts.map((short) => (
                <div key={short.id} className="flex items-center justify-between rounded-lg border border-border bg-secondary/20 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{short.title}</p>
                    {short.youtubeUrl ? (
                      <a href={short.youtubeUrl} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-primary flex items-center gap-1 mt-0.5 hover:text-primary/80 transition-colors">
                        <ExternalLink className="w-3 h-3" /> View on YouTube
                      </a>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-0.5">Not published</p>
                    )}
                  </div>
                  <div className="flex gap-1.5 shrink-0 ml-2">
                    <a href={short.url} target="_blank" rel="noopener noreferrer" className="btn-ghost text-xs py-1 px-2">
                      Download
                    </a>
                    {!short.youtubeUrl && !scheduleRunning && (
                      <button
                        disabled={publishingIdx === short.index}
                        onClick={() => publishShort(short)}
                        className="btn-primary text-xs py-1 px-2 gap-1"
                      >
                        {publishingIdx === short.index ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {/* Upload All scheduler panel */}
              {unpublishedShorts.length > 1 && !scheduleRunning && (
                <>
                  {!showScheduler ? (
                    <button
                      onClick={() => setShowScheduler(true)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border-2 border-dashed border-primary/30 text-sm font-medium text-primary hover:bg-primary/5 hover:border-primary/50 transition-all"
                    >
                      <PlayCircle className="w-4 h-4" />
                      Upload All {unpublishedShorts.length} Shorts (Scheduled)
                    </button>
                  ) : (
                    <div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-primary" />
                          <span className="text-sm font-semibold">Schedule Upload</span>
                        </div>
                        <button onClick={() => setShowScheduler(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">Upload {unpublishedShorts.length} shorts — how long to wait between each?</p>
                        <div className="grid grid-cols-1 gap-1.5">
                          {INTERVAL_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setIntervalMinutes(opt.value)}
                              className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-colors ${
                                intervalMinutes === opt.value
                                  ? "border-primary bg-primary/10 text-primary font-medium"
                                  : "border-border hover:border-primary/40 hover:bg-secondary/60 text-muted-foreground"
                              }`}
                            >
                              <span>{opt.label}</span>
                              {opt.value === 0 && <span className="text-xs bg-green-500/10 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded-full">Fastest</span>}
                              {opt.value === 15 && <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">Recommended</span>}
                            </button>
                          ))}
                        </div>
                      </div>

                      {intervalMinutes > 0 && (
                        <p className="text-xs text-muted-foreground bg-secondary/50 rounded-lg p-2.5 leading-relaxed">
                          Total time: ~{formatCountdown((unpublishedShorts.length - 1) * intervalMinutes * 60)} to upload all {unpublishedShorts.length} shorts
                        </p>
                      )}

                      <button onClick={startScheduledUpload} className="btn-primary w-full justify-center gap-2">
                        <PlayCircle className="w-4 h-4" />
                        Start Uploading
                      </button>
                    </div>
                  )}
                </>
              )}

              <button onClick={() => generateShorts(false)} disabled={loading} className="btn-ghost justify-center text-xs w-full">
                Regenerate Shorts
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
