"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, PlayCircle, Clock, CheckCircle2, XCircle, Loader2, FileText, Mic, ImageIcon, Film, Upload, RefreshCw, StopCircle, FolderOpen, TrendingUp, Copy, Check, Scissors, Camera, ThumbsUp } from "lucide-react";
import { ShortCard } from "@/components/videos/ShortCard";
import { formatDistanceToNow } from "date-fns";

const PIPELINE_STEPS = [
  { key: "SCRIPT", label: "Script", icon: FileText },
  { key: "AUDIO", label: "Audio", icon: Mic },
  { key: "IMAGES", label: "Images", icon: ImageIcon },
  { key: "ASSEMBLE", label: "Assemble", icon: Film },
  { key: "UPLOAD", label: "Upload", icon: Upload },
];

const STEP_ORDER = ["SCRIPT", "AUDIO", "IMAGES", "ASSEMBLE", "UPLOAD", "COMPLETE"];

export default function VideoDetailPage() {
  const params = useParams<{ videoId: string }>();
  const [video, setVideo] = useState<any>(null);
  const [publishing, setPublishing] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [replaceProgress, setReplaceProgress] = useState(0);
  const [converting, setConverting] = useState(false);
  const [seo, setSeo] = useState<any>(null);
  const [loadingSeo, setLoadingSeo] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [shorts, setShorts] = useState<any[]>([]);
  const [generatingShorts, setGeneratingShorts] = useState(false);
  const [shortsError, setShortsError] = useState<string | null>(null);
  const [expectedClips, setExpectedClips] = useState<number | null>(null);
  const [publishingShort, setPublishingShort] = useState<string | null>(null); // shortId being published
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [publishMode, setPublishMode] = useState<"single" | "all">("single");
  const [selectedShort, setSelectedShort] = useState<any | null>(null);
  const [shortTitleInput, setShortTitleInput] = useState("");
  const [shortDescriptionInput, setShortDescriptionInput] = useState("");
  const [publishingAllShorts, setPublishingAllShorts] = useState(false);
  const [publishAllDone, setPublishAllDone] = useState(0);
  const [publishAllTotal, setPublishAllTotal] = useState(0);
  const [uploadCount, setUploadCount] = useState<number | "all">("all");
  const [uploadIntervalMinutes, setUploadIntervalMinutes] = useState(0);
  const [privacyMode, setPrivacyMode] = useState<"unlisted" | "public" | "scheduled">("scheduled");
  const [uploadCountdown, setUploadCountdown] = useState(0);
  const uploadCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const uploadScheduleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [videoPublishDialogOpen, setVideoPublishDialogOpen] = useState(false);
  const [videoTitleInput, setVideoTitleInput] = useState("");
  const [videoDescriptionInput, setVideoDescriptionInput] = useState("");
  const [instagramPublishDialogOpen, setInstagramPublishDialogOpen] = useState(false);
  const [instagramTitleInput, setInstagramTitleInput] = useState("");
  const [instagramDescriptionInput, setInstagramDescriptionInput] = useState("");
  const [publishingInstagram, setPublishingInstagram] = useState(false);
  const [facebookPublishDialogOpen, setFacebookPublishDialogOpen] = useState(false);
  const [facebookTitleInput, setFacebookTitleInput] = useState("");
  const [facebookDescriptionInput, setFacebookDescriptionInput] = useState("");
  const [publishingFacebook, setPublishingFacebook] = useState(false);

  const fetchVideo = useCallback(() => {
    fetch(`/api/videos/${params.videoId}`)
      .then((r) => r.json())
      .then(setVideo);
  }, [params.videoId]);

  const fetchShorts = useCallback(() => {
    return fetch(`/api/videos/${params.videoId}/shorts`)
      .then((r) => r.ok ? r.json() : { shorts: [] })
      .then((d) => setShorts(d.shorts ?? []));
  }, [params.videoId]);

  useEffect(() => {
    fetchVideo();
  }, [fetchVideo]);

  useEffect(() => {
    fetchShorts();
  }, [fetchShorts]);

  // Poll while generating
  useEffect(() => {
    if (!video) return;
    if (video.status !== "GENERATING" && video.status !== "PENDING") return;
    const timer = setInterval(fetchVideo, 2000);
    return () => clearInterval(timer);
  }, [video, fetchVideo]);

  async function handleCancel() {
    setCancelling(true);
    const res = await fetch(`/api/videos/${params.videoId}/cancel`, { method: "POST" });
    setCancelling(false);
    if (res.ok) {
      toast.success("Generation cancelled.");
      fetchVideo();
    } else {
      toast.error("Failed to cancel.");
    }
  }

  async function loadSEO() {
    setLoadingSeo(true);
    const res = await fetch(`/api/videos/${params.videoId}/seo`);
    setLoadingSeo(false);
    if (res.ok) {
      setSeo(await res.json());
    } else {
      toast.error("Failed to generate SEO suggestions.");
    }
  }

  async function applyTitle(title: string) {
    await fetch(`/api/videos/${params.videoId}/seo`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    toast.success("Title updated!");
    fetchVideo();
  }

  function copyText(text: string, idx: number) {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  }

  async function handleConvert(targetFormat: string) {
    setConverting(true);
    const res = await fetch(`/api/videos/${params.videoId}/convert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetFormat }),
    });
    setConverting(false);
    if (res.ok) {
      toast.success(`Converted to ${targetFormat}!`);
      fetchVideo();
    } else {
      const d = await res.json();
      toast.error(d.error || "Conversion failed.");
    }
  }

  function handleReplace() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "video/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setReplacing(true);
      setReplaceProgress(0);

      const formData = new FormData();
      formData.append("file", file);

      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setReplaceProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        setReplacing(false);
        setReplaceProgress(0);
        if (xhr.status === 200) {
          toast.success("Video replaced!");
          fetchVideo();
        } else {
          toast.error("Failed to replace video.");
        }
      };
      xhr.onerror = () => { setReplacing(false); toast.error("Upload failed."); };
      xhr.open("POST", `/api/videos/${params.videoId}/replace`);
      xhr.send(formData);
    };
    input.click();
  }

  async function handleRetry() {
    setRetrying(true);
    const res = await fetch(`/api/videos/${params.videoId}/retry`, { method: "POST" });
    setRetrying(false);
    if (res.ok) {
      toast.success("Retrying video generation...");
      fetchVideo();
    } else {
      toast.error("Failed to retry.");
    }
  }

  function getDefaultVideoDescription() {
    try {
      const parsed = video?.script ? JSON.parse(video.script) : null;
      const description =
        typeof parsed?.description === "string" ? parsed.description.trim() : "";
      const hashtags = Array.isArray(parsed?.hashtags)
        ? parsed.hashtags.filter((h: unknown) => typeof h === "string" && h.trim()).join(" ")
        : "";
      if (description && hashtags) return `${description}\n\n${hashtags}`;
      if (description) return description;
      if (hashtags) return hashtags;
    } catch {
      // Ignore malformed script JSON and fall back to empty description.
    }
    return "";
  }

  function openVideoPublishDialog() {
    setVideoTitleInput(typeof video?.title === "string" ? video.title : "");
    setVideoDescriptionInput(getDefaultVideoDescription());
    setVideoPublishDialogOpen(true);
  }

  function openInstagramPublishDialog() {
    setInstagramTitleInput(typeof video?.title === "string" ? video.title : "");
    setInstagramDescriptionInput(getDefaultVideoDescription());
    setInstagramPublishDialogOpen(true);
  }

  function openFacebookPublishDialog() {
    setFacebookTitleInput(typeof video?.title === "string" ? video.title : "");
    setFacebookDescriptionInput(getDefaultVideoDescription());
    setFacebookPublishDialogOpen(true);
  }

  async function handlePublish() {
    const title = videoTitleInput.trim();
    const description = videoDescriptionInput.trim();
    if (!title) {
      toast.error("Please enter a title before publishing.");
      return;
    }

    setPublishing(true);
    try {
      const res = await fetch(`/api/videos/${params.videoId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Publish failed. Is YouTube connected?");
        return;
      }
      toast.success("Published to YouTube!");
      setVideoPublishDialogOpen(false);
      fetchVideo();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Publish failed. Please try again.");
    } finally {
      setPublishing(false);
    }
  }

  async function handleInstagramPublish() {
    const title = instagramTitleInput.trim();
    const description = instagramDescriptionInput.trim();
    if (!title) {
      toast.error("Please enter a title before publishing.");
      return;
    }

    setPublishingInstagram(true);
    try {
      const res = await fetch(`/api/videos/${params.videoId}/instagram`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Instagram publish failed");
        return;
      }
      toast.success("Published to Instagram!");
      setInstagramPublishDialogOpen(false);
      fetchVideo();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Instagram publish failed. Please try again.");
    } finally {
      setPublishingInstagram(false);
    }
  }

  async function handleFacebookPublish() {
    const title = facebookTitleInput.trim();
    const description = facebookDescriptionInput.trim();
    if (!title) {
      toast.error("Please enter a title before publishing.");
      return;
    }

    setPublishingFacebook(true);
    try {
      const res = await fetch(`/api/videos/${params.videoId}/facebook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Facebook publish failed");
        return;
      }
      toast.success("Published to Facebook!");
      setFacebookPublishDialogOpen(false);
      fetchVideo();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Facebook publish failed. Please try again.");
    } finally {
      setPublishingFacebook(false);
    }
  }

  async function handleGenerateShorts() {
    setGeneratingShorts(true);
    setShortsError(null);
    setShorts([]);
    // Calculate expected clip count from video duration so the user can see progress
    if (video?.durationSeconds) {
      setExpectedClips(Math.floor(video.durationSeconds / 60));
    }
    const poller = setInterval(() => {
      fetchShorts();
    }, 1200);

    try {
      const res = await fetch(`/api/videos/${params.videoId}/shorts`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setShorts(data.shorts ?? []);
        toast.success(`${data.shorts?.length ?? 0} clips created!`);
      } else {
        const d = await res.json().catch(() => ({}));
        const msg = d.error || "Failed to generate Shorts";
        setShortsError(msg);
        toast.error(msg);
      }
    } finally {
      clearInterval(poller);
      setGeneratingShorts(false);
      setExpectedClips(null);
    }
  }

  function getDefaultShortDescription() {
    try {
      const parsed = video?.script ? JSON.parse(video.script) : null;
      if (typeof parsed?.description === "string" && parsed.description.trim()) {
        return parsed.description.trim();
      }
    } catch {
      // Ignore invalid script JSON and fallback to the video title below.
    }
    return typeof video?.title === "string" ? video.title : "";
  }

  function toBaseShortTitle(title: string) {
    return title.trim().replace(/\s*[-–—]?\s*part\s+\d+\s*$/i, "");
  }

  function openPublishDialog(short: any) {
    setPublishMode("single");
    setSelectedShort(short);
    setShortTitleInput(toBaseShortTitle(short.title ?? video?.title ?? ""));
    setShortDescriptionInput(getDefaultShortDescription());
    setPublishAllDone(0);
    setPublishAllTotal(0);
    setPublishDialogOpen(true);
  }

  function openPublishAllDialog() {
    const unpublished = shorts.filter((s) => !s.youtubeVideoId);
    if (unpublished.length === 0) {
      toast.info("All shorts are already uploaded.");
      return;
    }

    setPublishMode("all");
    setSelectedShort(null);
    setShortTitleInput(toBaseShortTitle(unpublished[0]?.title ?? video?.title ?? ""));
    setShortDescriptionInput(getDefaultShortDescription());
    setPublishAllDone(0);
    setPublishAllTotal(0);
    setUploadCount("all");
    setUploadIntervalMinutes(0);
    setUploadCountdown(0);
    setPublishDialogOpen(true);
  }

  function closePublishDialog(force = false) {
    if ((publishingShort || publishingAllShorts) && !force) return;
    // Clear any running schedule timers
    if (uploadCountdownRef.current) clearInterval(uploadCountdownRef.current);
    if (uploadScheduleRef.current) clearTimeout(uploadScheduleRef.current);
    setPublishDialogOpen(false);
    setPublishMode("single");
    setSelectedShort(null);
    setShortTitleInput("");
    setShortDescriptionInput("");
    setPublishAllDone(0);
    setPublishAllTotal(0);
    setUploadCountdown(0);
  }

  async function publishShortRequest(shortId: string, payload: { title: string; description: string; privacy?: string }) {
    const res = await fetch(`/api/shorts/${shortId}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || "Publish failed");
    }

    return res.json();
  }

  async function handlePublishShort(
    shortId: string,
    payload: { title: string; description: string; privacy?: string },
    options?: {
      notify?: boolean;
      refreshAfter?: boolean;
      closeOnSuccess?: boolean;
    }
  ) {
    const notify = options?.notify ?? true;
    const refreshAfter = options?.refreshAfter ?? true;
    const closeOnSuccess = options?.closeOnSuccess ?? true;

    setPublishingShort(shortId);
    try {
      const data = await publishShortRequest(shortId, payload);
      setShorts((prev) =>
        prev.map((s) =>
          s.id === shortId
            ? {
                ...s,
                title: data.title ?? `${toBaseShortTitle(payload.title)} Part ${s.index + 1}`,
                youtubeUrl: data.youtubeUrl,
                youtubeVideoId: data.youtubeVideoId ?? "published",
              }
            : s
        )
      );
      if (refreshAfter) {
        await fetchShorts();
      }
      if (notify) {
        toast.success("Short published to YouTube!");
      }
      if (closeOnSuccess) {
        closePublishDialog(true);
      }
      return true;
    } catch (error) {
      if (notify) {
        const message = error instanceof Error ? error.message : "Publish failed";
        toast.error(message);
      }
      return false;
    } finally {
      setPublishingShort(null);
    }
  }

  async function submitSelectedShort() {
    if (!selectedShort) return;
    const title = shortTitleInput.trim();
    const description = shortDescriptionInput.trim();

    if (!title) {
      toast.error("Please enter a title before upload.");
      return;
    }

    await handlePublishShort(selectedShort.id, { title, description, privacy: privacyMode }, {
      notify: true,
      refreshAfter: true,
      closeOnSuccess: true,
    });
  }

  async function submitPublishAllShorts() {
    const title = shortTitleInput.trim();
    const description = shortDescriptionInput.trim();

    if (!title) {
      toast.error("Please enter a title before upload.");
      return;
    }

    const allUnpublished = shorts
      .filter((s) => !s.youtubeVideoId)
      .sort((a, b) => a.index - b.index);

    if (allUnpublished.length === 0) {
      toast.info("All shorts are already uploaded.");
      closePublishDialog(true);
      return;
    }

    const toUpload = uploadCount === "all"
      ? allUnpublished
      : allUnpublished.slice(0, uploadCount);

    setPublishingAllShorts(true);
    setPublishAllDone(0);
    setPublishAllTotal(toUpload.length);
    setUploadCountdown(0);

    let successCount = 0;

    try {
      for (let i = 0; i < toUpload.length; i++) {
        // Wait interval before each upload (except the first)
        if (i > 0 && uploadIntervalMinutes > 0) {
          await new Promise<void>((resolve) => {
            let remaining = uploadIntervalMinutes * 60;
            setUploadCountdown(remaining);
            uploadCountdownRef.current = setInterval(() => {
              remaining -= 1;
              setUploadCountdown(remaining);
              if (remaining <= 0 && uploadCountdownRef.current) {
                clearInterval(uploadCountdownRef.current);
              }
            }, 1000);
            uploadScheduleRef.current = setTimeout(() => {
              if (uploadCountdownRef.current) clearInterval(uploadCountdownRef.current);
              setUploadCountdown(0);
              resolve();
            }, uploadIntervalMinutes * 60 * 1000);
          });
        }

        const ok = await handlePublishShort(
          toUpload[i].id,
          { title, description, privacy: privacyMode },
          { notify: false, refreshAfter: false, closeOnSuccess: false }
        );
        if (ok) successCount += 1;
        setPublishAllDone(i + 1);
      }

      await fetchShorts();
    } finally {
      setPublishingAllShorts(false);
      setUploadCountdown(0);
      if (uploadCountdownRef.current) clearInterval(uploadCountdownRef.current);
      if (uploadScheduleRef.current) clearTimeout(uploadScheduleRef.current);
    }

    if (successCount === toUpload.length) {
      toast.success(`${successCount} short${successCount !== 1 ? "s" : ""} uploaded to YouTube!`);
      closePublishDialog(true);
      return;
    }

    toast.error(`${successCount}/${toUpload.length} shorts uploaded. Retry failed ones.`);
  }

  if (!video) {
    return (
      <div className="flex items-center justify-center py-20 gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading…
      </div>
    );
  }

  const isGenerating = video.status === "GENERATING" || video.status === "PENDING";
  const isFailed = video.status === "FAILED";
  const isReady = video.status === "READY";
  const isPublished = video.status === "PUBLISHED";
  const unpublishedShorts = shorts.filter((s) => !s.youtubeVideoId);
  const previewBaseShortTitle = toBaseShortTitle(
    shortTitleInput || selectedShort?.title || shorts[0]?.title || video?.title || "Short"
  );
  const showSinglePartPreview = publishMode === "single" || unpublishedShorts.length <= 1;
  const generatedShorts = expectedClips ? Math.min(shorts.length, expectedClips) : shorts.length;
  const shortsProgressPercent =
    expectedClips && expectedClips > 0
      ? Math.min(100, Math.round((generatedShorts / expectedClips) * 100))
      : 0;

  const currentStepIndex = video.job
    ? STEP_ORDER.indexOf(video.job.currentStep)
    : -1;

  const statusClass: Record<string, string> = {
    PUBLISHED: "status-pill status-pill-published",
    READY:     "status-pill status-pill-ready",
    GENERATING:"status-pill status-pill-generating",
    SCHEDULED: "status-pill status-pill-scheduled",
    FAILED:    "status-pill status-pill-failed",
    PENDING:   "status-pill status-pill-pending",
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-4 justify-between flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/videos"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0">
            <ArrowLeft className="h-3.5 w-3.5" /> Videos
          </Link>
          <span className="text-border">/</span>
          <h1 className="text-xl font-bold truncate max-w-xs">{video.title}</h1>
          <span className={statusClass[video.status] ?? "status-pill status-pill-pending"}>
            {isGenerating && <span className="live-dot" />}
            {video.status.toLowerCase()}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {video.youtubeUrl && (
            <a href={video.youtubeUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors">
              <PlayCircle className="h-3.5 w-3.5 text-red-500" /> Watch <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {video.instagramUrl && (
            <a href={video.instagramUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors">
              <Camera className="h-3.5 w-3.5 text-pink-500" /> Instagram <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {video.facebookUrl && (
            <a href={video.facebookUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors">
              <ThumbsUp className="h-3.5 w-3.5 text-blue-500" /> Facebook <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {isGenerating && (
            <button onClick={handleCancel} disabled={cancelling}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-colors disabled:opacity-50">
              {cancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <StopCircle className="h-3.5 w-3.5" />}
              Cancel
            </button>
          )}
          {(isReady || isPublished || isFailed) && (
            <button onClick={handleReplace} disabled={replacing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors disabled:opacity-50">
              {replacing ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {replaceProgress > 0 ? `${replaceProgress}%` : "Uploading…"}</> : <><FolderOpen className="h-3.5 w-3.5" /> Replace</>}
            </button>
          )}
          {isFailed && (
            <button onClick={handleRetry} disabled={retrying}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors disabled:opacity-50">
              {retrying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Retry
            </button>
          )}
          {(isReady || isPublished) && (
            <button onClick={loadSEO} disabled={loadingSeo}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors disabled:opacity-50">
              {loadingSeo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TrendingUp className="h-3.5 w-3.5" />}
              Boost Views
            </button>
          )}
          {isReady && (
            <button onClick={openVideoPublishDialog} disabled={publishing}
              className="btn-primary text-xs py-1.5 px-3">
              {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
              Publish to YouTube
            </button>
          )}
          {(isReady || isPublished) && !video.instagramMediaId && (
            <button onClick={openInstagramPublishDialog} disabled={publishingInstagram}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors disabled:opacity-50">
              {publishingInstagram ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5 text-pink-500" />}
              Instagram
            </button>
          )}
          {(isReady || isPublished) && !video.facebookPostId && (
            <button onClick={openFacebookPublishDialog} disabled={publishingFacebook}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors disabled:opacity-50">
              {publishingFacebook ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ThumbsUp className="h-3.5 w-3.5 text-blue-500" />}
              Facebook
            </button>
          )}
        </div>
      </div>

      {/* Generation Progress */}
      {(isGenerating || isFailed) && video.job && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <p className="text-sm font-semibold">
            {isFailed ? "Generation Failed" : "Generating…"}
          </p>
          <div className="progress-bar">
            <div className="progress-bar-fill" style={{ width: `${video.job.overallProgress}%` }} />
          </div>
            <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
              <p className="truncate">
                {video.job.stepMessage || "Processing..."}
              </p>
              <span className="shrink-0">
                {video.job.currentStep === "ASSEMBLE"
                  ? `${video.job.stepProgress ?? 0}%`
                  : `${video.job.overallProgress ?? 0}%`}
              </span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {PIPELINE_STEPS.map(({ key, label, icon: Icon }) => {
                const stepIdx = STEP_ORDER.indexOf(key);
                const isActive = video.job.currentStep === key;
                const isDone = currentStepIndex > stepIdx && video.job.currentStep !== "FAILED";
                const hasFailed = video.job.currentStep === "FAILED" && video.job.failedStep === key;

                return (
                  <div
                    key={key}
                    className={`flex items-center gap-1.5 text-sm px-2.5 py-1 rounded-md ${
                      isDone ? "text-green-400" :
                      isActive ? "text-primary bg-primary/10" :
                      hasFailed ? "text-destructive" :
                      "text-muted-foreground"
                    }`}
                  >
                    {hasFailed ? (
                      <XCircle className="h-3.5 w-3.5" />
                    ) : isDone ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : isActive ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Icon className="h-3.5 w-3.5" />
                    )}
                    {label}
                  </div>
                );
              })}
            </div>
            {isFailed && video.errorMessage && (
              <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                {video.errorMessage}
              </p>
            )}
        </div>
      )}

      {/* Audio Preview — visible as soon as audio is generated */}
      {video.audioUrl && !video.videoUrl && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <p className="text-sm font-semibold flex items-center gap-2">
            <Mic className="h-4 w-4" /> Audio Preview
          </p>
          <audio src={video.audioUrl} controls className="w-full" />
        </div>
      )}

      {/* Video Player */}
      {video.videoUrl && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <video src={video.videoUrl} controls className="w-full aspect-video bg-black" />
          {(isReady || isPublished) && (
            <div className="px-4 py-3 border-t border-border/60 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground mr-1">Convert format:</span>
              {[
                { value: "landscape", label: "▭ Landscape (16:9)" },
                { value: "shorts",   label: "▯ Shorts (9:16)" },
                { value: "square",   label: "□ Square (1:1)" },
              ].map((f) => (
                <button
                  key={f.value}
                  onClick={() => handleConvert(f.value)}
                  disabled={converting}
                  className="px-3 py-1 text-xs rounded-md border border-border hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
                >
                  {converting ? <Loader2 className="h-3 w-3 animate-spin inline mr-1" /> : null}
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Shorts Section */}
      {(isReady || isPublished) && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm font-semibold flex items-center gap-2">
              <Scissors className="h-4 w-4 text-red-500" />
              YouTube Shorts
              {shorts.length > 0 && <span className="text-xs font-normal text-muted-foreground">({shorts.length} clip{shorts.length !== 1 ? "s" : ""})</span>}
              {video.durationSeconds && shorts.length === 0 && !generatingShorts && (
                <span className="text-xs font-normal text-muted-foreground">
                  {video.durationSeconds >= 60 ? `${Math.floor(video.durationSeconds / 60)} clips (1 min each)` : "Video must be at least 1 min"}
                </span>
              )}
            </p>
            <div className="flex items-center gap-2">
              {shorts.length > 1 && unpublishedShorts.length > 0 && (
                <button onClick={openPublishAllDialog}
                  disabled={generatingShorts || publishingAllShorts || Boolean(publishingShort)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors disabled:opacity-50">
                  {publishingAllShorts ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading All…</> : <><Upload className="h-3.5 w-3.5" /> Upload All</>}
                </button>
              )}
              <button onClick={handleGenerateShorts}
                disabled={generatingShorts || publishingAllShorts || Boolean(publishingShort)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${shorts.length > 0 ? "border border-border text-muted-foreground hover:text-foreground hover:bg-secondary/50" : "btn-primary py-1.5 px-3"}`}>
                {generatingShorts ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Splitting…</>
                  : shorts.length > 0 ? <><RefreshCw className="h-3.5 w-3.5" /> Regenerate</>
                  : <><Scissors className="h-3.5 w-3.5" /> Split into Shorts</>}
              </button>
            </div>
          </div>
          <div>
            {shortsError && (
              <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg mb-3">{shortsError}</p>
            )}
            {generatingShorts && (
              <div className="space-y-3 py-2">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
                  <span>
                    Splitting into {expectedClips ? `${expectedClips} × 1-min` : "1-min"} clips…
                    {expectedClips && (
                      <span className="text-xs ml-2 text-muted-foreground">
                        This may take a few minutes for long videos.
                      </span>
                    )}
                  </span>
                </div>
                {expectedClips ? (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{generatedShorts} / {expectedClips} generated</span>
                      <span>{shortsProgressPercent}%</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-bar-fill" style={{ width: `${shortsProgressPercent}%` }} />
                    </div>
                  </div>
                ) : null}
                {expectedClips && (
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: expectedClips }).map((_, i) => (
                      <span
                        key={i}
                        className="text-xs px-2 py-0.5 rounded-full border border-border text-muted-foreground"
                      >
                        Clip {i + 1}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
            {!generatingShorts && shorts.length === 0 && !shortsError && (
              <p className="text-sm text-muted-foreground py-2">
                No clips yet — click <strong>Split into Shorts</strong>.
                {video.durationSeconds && (
                  <>
                    {" "}
                    {video.durationSeconds >= 60
                      ? `Your video will produce ${Math.floor(video.durationSeconds / 60)} × 1-min clips.`
                      : "Videos under 1 minute cannot be split into Shorts."}
                  </>
                )}
              </p>
            )}
            {shorts.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[600px] overflow-y-auto pr-1">
                {shorts.map((s: any) => (
                  <ShortCard
                    key={s.id}
                    short={s}
                    publishingShort={publishingShort}
                    publishingAllShorts={publishingAllShorts}
                    onPublish={openPublishDialog}
                    onUpdated={(updated) => setShorts((prev: any[]) => prev.map((x) => x.id === updated.id ? updated : x))}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Details */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[11px] text-muted-foreground mb-1">Created</p>
          <p className="font-medium text-sm">{formatDistanceToNow(new Date(video.createdAt), { addSuffix: true })}</p>
        </div>
        {video.durationSeconds && (
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[11px] text-muted-foreground mb-1 flex items-center gap-1">
              <Clock className="h-3 w-3" /> Duration
            </p>
            <p className="font-medium text-sm">{Math.floor(video.durationSeconds / 60)}m {video.durationSeconds % 60}s</p>
          </div>
        )}
      </div>

      {/* Script */}
      {video.script && (() => {
        try {
          const scriptData = JSON.parse(video.script);
          return (
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <p className="text-sm font-semibold">Script</p>
              {scriptData.description?.trim() && (
                <p className="text-sm text-muted-foreground">{scriptData.description}</p>
              )}
              <div className="space-y-2">
                {scriptData.segments?.map((seg: { text: string; visualDescription: string }, i: number) => (
                  <div key={i} className="p-3 rounded-lg bg-secondary/50">
                    <p className="text-sm">{seg.text}</p>
                    <p className="text-xs text-muted-foreground mt-1 italic">Visual: {seg.visualDescription}</p>
                  </div>
                ))}
              </div>
              {scriptData.tags && (
                <div className="flex flex-wrap gap-1.5">
                  {scriptData.tags.map((tag: string) => (
                    <span key={tag} className="px-2 py-0.5 bg-secondary/70 rounded text-xs text-muted-foreground">#{tag}</span>
                  ))}
                </div>
              )}
            </div>
          );
        } catch { return null; }
      })()}

      {/* Images */}
      {video.imageAssets?.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <p className="text-sm font-semibold">Generated Images ({video.imageAssets.length})</p>
          <div className="grid grid-cols-3 gap-2">
            {video.imageAssets.map((asset: any) => (
              <img key={asset.id} src={asset.url} alt={`Scene ${asset.index + 1}`}
                className="rounded-lg aspect-video object-cover w-full" />
            ))}
          </div>
        </div>
      )}

      {/* SEO Boost Panel */}
      {seo && (
        <div className="rounded-xl border border-primary/20 bg-card p-5 space-y-5">
          <p className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> View Booster — SEO Suggestions
          </p>
          <div className="space-y-5">

            {/* Viral Titles */}
            <div>
              <p className="text-sm font-medium mb-2">Viral Title Options — click to apply</p>
              <div className="space-y-2">
                {seo.titles?.map((t: string, i: number) => (
                  <div key={i} className="flex items-center gap-2 group">
                    <button
                      onClick={() => applyTitle(t)}
                      className="flex-1 text-left text-sm px-3 py-2 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors"
                    >
                      {t}
                    </button>
                    <button onClick={() => copyText(t, i)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                      {copiedIdx === i ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Hook */}
            {seo.hook && (
              <div>
                <p className="text-sm font-medium mb-1">Rewritten Opening Hook</p>
                <div className="flex items-start gap-2 group">
                  <p className="flex-1 text-sm p-3 rounded-lg bg-primary/5 border border-primary/20 text-primary">{seo.hook}</p>
                  <button onClick={() => copyText(seo.hook, 99)} className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {copiedIdx === 99 ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
                  </button>
                </div>
              </div>
            )}

            {/* Description */}
            {seo.description && (
              <div>
                <p className="text-sm font-medium mb-1">SEO Description</p>
                <div className="flex items-start gap-2 group">
                  <p className="flex-1 text-sm p-3 rounded-lg bg-secondary/50 text-muted-foreground whitespace-pre-wrap">{seo.description}</p>
                  <button onClick={() => copyText(seo.description, 100)} className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {copiedIdx === 100 ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
                  </button>
                </div>
              </div>
            )}

            {/* Tags */}
            {seo.tags?.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">High-Traffic Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {seo.tags.map((tag: string, i: number) => (
                    <button
                      key={i}
                      onClick={() => copyText(tag, 200 + i)}
                      className="px-2 py-0.5 text-xs bg-secondary rounded hover:bg-primary/10 hover:text-primary transition-colors"
                    >
                      {copiedIdx === 200 + i ? "✓" : tag}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Hashtags */}
            {seo.hashtags?.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Trending Hashtags</p>
                <div className="flex flex-wrap gap-1.5">
                  {seo.hashtags.map((h: string, i: number) => (
                    <button
                      key={i}
                      onClick={() => copyText(h, 300 + i)}
                      className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors"
                    >
                      {copiedIdx === 300 + i ? "✓" : h}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Tips + Posting Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {seo.bestPostingTime && (
                <div className="p-3 rounded-lg bg-secondary/50">
                  <p className="text-xs text-muted-foreground mb-1">Best Posting Time</p>
                  <p className="text-sm font-medium">{seo.bestPostingTime}</p>
                </div>
              )}
              {seo.tips?.length > 0 && (
                <div className="p-3 rounded-lg bg-secondary/50">
                  <p className="text-xs text-muted-foreground mb-1">Tips for More Views</p>
                  <ul className="space-y-1">
                    {seo.tips.map((tip: string, i: number) => (
                      <li key={i} className="text-xs flex gap-1.5"><span className="text-primary">•</span>{tip}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <Dialog open={videoPublishDialogOpen} onOpenChange={setVideoPublishDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Publish Video to YouTube</DialogTitle>
            <DialogDescription>
              Review and edit the title and description before publishing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="video-title">Title</Label>
              <Input
                id="video-title"
                value={videoTitleInput}
                onChange={(e) => setVideoTitleInput(e.target.value)}
                placeholder="Enter video title"
                disabled={publishing}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="video-description">Description</Label>
              <Textarea
                id="video-description"
                value={videoDescriptionInput}
                onChange={(e) => setVideoDescriptionInput(e.target.value)}
                placeholder="Enter YouTube description"
                rows={6}
                disabled={publishing}
              />
            </div>
            <button className="btn-primary w-full justify-center" onClick={handlePublish} disabled={!videoTitleInput.trim() || publishing}>
              {publishing ? <><Loader2 className="h-4 w-4 animate-spin" /> Publishing…</> : <><PlayCircle className="h-4 w-4" /> Publish to YouTube</>}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={instagramPublishDialogOpen} onOpenChange={setInstagramPublishDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Publish Video to Instagram</DialogTitle>
            <DialogDescription>
              Instagram publishes as a Reel. Review your title and caption first.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="instagram-title">Title</Label>
              <Input
                id="instagram-title"
                value={instagramTitleInput}
                onChange={(e) => setInstagramTitleInput(e.target.value)}
                placeholder="Enter Reel title"
                disabled={publishingInstagram}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="instagram-description">Caption</Label>
              <Textarea
                id="instagram-description"
                value={instagramDescriptionInput}
                onChange={(e) => setInstagramDescriptionInput(e.target.value)}
                placeholder="Enter Reel caption"
                rows={6}
                disabled={publishingInstagram}
              />
            </div>
            <button className="btn-primary w-full justify-center" onClick={handleInstagramPublish} disabled={!instagramTitleInput.trim() || publishingInstagram}>
              {publishingInstagram ? <><Loader2 className="h-4 w-4 animate-spin" /> Publishing…</> : <><Camera className="h-4 w-4" /> Publish to Instagram</>}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={facebookPublishDialogOpen} onOpenChange={setFacebookPublishDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Publish Video to Facebook</DialogTitle>
            <DialogDescription>
              Publish this video to your connected Facebook Page.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="facebook-title">Title</Label>
              <Input
                id="facebook-title"
                value={facebookTitleInput}
                onChange={(e) => setFacebookTitleInput(e.target.value)}
                placeholder="Enter Facebook video title"
                disabled={publishingFacebook}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="facebook-description">Description</Label>
              <Textarea
                id="facebook-description"
                value={facebookDescriptionInput}
                onChange={(e) => setFacebookDescriptionInput(e.target.value)}
                placeholder="Enter Facebook description"
                rows={6}
                disabled={publishingFacebook}
              />
            </div>
            <button className="btn-primary w-full justify-center" onClick={handleFacebookPublish} disabled={!facebookTitleInput.trim() || publishingFacebook}>
              {publishingFacebook ? <><Loader2 className="h-4 w-4 animate-spin" /> Publishing…</> : <><ThumbsUp className="h-4 w-4" /> Publish to Facebook</>}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={publishDialogOpen}
        onOpenChange={(open) => {
          if (open) {
            setPublishDialogOpen(true);
            return;
          }
          closePublishDialog();
        }}
      >
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {publishMode === "all" ? "Upload Shorts to YouTube" : "Upload Short to YouTube"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="short-title">Base Title</Label>
              <Input
                id="short-title"
                value={shortTitleInput}
                onChange={(e) => setShortTitleInput(e.target.value)}
                placeholder="Enter base title"
                disabled={Boolean(publishingShort) || publishingAllShorts}
              />
              <p className="text-xs text-muted-foreground">
                {showSinglePartPreview ? (
                  <>Will upload as: <strong>{previewBaseShortTitle} Part 1</strong></>
                ) : (
                  <>All clips renamed as: <strong>{previewBaseShortTitle} Part 1, Part 2…</strong></>
                )}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="short-description">Description</Label>
              <Textarea
                id="short-description"
                value={shortDescriptionInput}
                onChange={(e) => setShortDescriptionInput(e.target.value)}
                placeholder="Enter Short description"
                rows={3}
                disabled={Boolean(publishingShort) || publishingAllShorts}
              />
            </div>

            {/* Privacy picker — shown for both single and all modes */}
            {!publishingAllShorts && publishAllTotal === 0 && (
              <div className="space-y-2">
                <Label className="text-xs">YouTube visibility</Label>
                <div className="flex gap-2">
                  {([
                    { value: "scheduled", label: "Scheduled", sub: "Public in 10-min gaps" },
                    { value: "unlisted", label: "Unlisted", sub: "Link only" },
                    { value: "public",   label: "Public",    sub: "Visible immediately" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPrivacyMode(opt.value)}
                      className={`flex-1 flex flex-col items-center gap-0.5 px-2 py-2 rounded-lg border text-xs font-medium transition-colors ${
                        privacyMode === opt.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/40 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span>{opt.label}</span>
                      <span className="text-[10px] font-normal opacity-70">{opt.sub}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Count + Interval pickers — only for "all" mode before upload starts */}
            {publishMode === "all" && !publishingAllShorts && publishAllTotal === 0 && (
              <>
                {/* How many to upload */}
                <div className="space-y-2">
                  <Label className="text-xs">How many to upload?</Label>
                  <div className="flex flex-wrap gap-2">
                    {([10, 20, 30, "all"] as const).map((n) => {
                      const label = n === "all"
                        ? `All (${unpublishedShorts.length})`
                        : `${n}`;
                      const disabled = n !== "all" && n > unpublishedShorts.length;
                      return (
                        <button
                          key={n}
                          type="button"
                          disabled={disabled}
                          onClick={() => setUploadCount(n)}
                          className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                            uploadCount === n
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border hover:border-primary/40 text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {unpublishedShorts.length} unpublished short{unpublishedShorts.length !== 1 ? "s" : ""} available
                  </p>
                </div>

                {/* Interval between uploads */}
                <div className="space-y-2">
                  <Label className="text-xs">Delay between each upload</Label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: "None", value: 0 },
                      { label: "5 min", value: 5 },
                      { label: "10 min", value: 10 },
                      { label: "15 min", value: 15 },
                      { label: "30 min", value: 30 },
                      { label: "1 hr", value: 60 },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setUploadIntervalMinutes(opt.value)}
                        className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                          uploadIntervalMinutes === opt.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:border-primary/40 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {uploadIntervalMinutes > 0 && (() => {
                    const count = uploadCount === "all" ? unpublishedShorts.length : Math.min(uploadCount, unpublishedShorts.length);
                    const totalMins = (count - 1) * uploadIntervalMinutes;
                    const h = Math.floor(totalMins / 60);
                    const m = totalMins % 60;
                    return (
                      <p className="text-xs text-muted-foreground">
                        Total time: ~{h > 0 ? `${h}h ` : ""}{m > 0 ? `${m}m` : "instant"} for {count} uploads
                      </p>
                    );
                  })()}
                </div>
              </>
            )}

            {/* Progress while uploading */}
            {publishMode === "all" && publishAllTotal > 0 && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                <div className="flex justify-between text-sm font-medium">
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    Uploading shorts…
                  </span>
                  <span className="text-muted-foreground tabular-nums">{publishAllDone} / {publishAllTotal}</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-bar-fill" style={{ width: `${Math.round((publishAllDone / publishAllTotal) * 100)}%` }} />
                </div>
                {uploadCountdown > 0 && (
                  <div className="text-center space-y-1.5 pt-1">
                    <p className="text-xs text-muted-foreground">Next upload in</p>
                    <p className="text-xl font-bold tabular-nums text-primary">
                      {Math.floor(uploadCountdown / 60) > 0
                        ? `${Math.floor(uploadCountdown / 60)}m ${uploadCountdown % 60}s`
                        : `${uploadCountdown}s`}
                    </p>
                    <div className="progress-bar">
                      <div
                        className="progress-bar-fill transition-none"
                        style={{ width: `${100 - (uploadCountdown / (uploadIntervalMinutes * 60)) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              className="btn-primary w-full justify-center"
              onClick={publishMode === "all" ? submitPublishAllShorts : submitSelectedShort}
              disabled={
                !shortTitleInput.trim() ||
                publishingAllShorts ||
                (publishMode === "single" && (!selectedShort || publishingShort === selectedShort?.id))
              }
            >
              {publishingAllShorts ? (
                uploadCountdown > 0
                  ? <><Clock className="h-4 w-4" /> Waiting… ({publishAllDone}/{publishAllTotal} done)</>
                  : <><Loader2 className="h-4 w-4 animate-spin" /> Uploading {publishAllDone}/{publishAllTotal}…</>
              ) : publishMode === "single" && publishingShort === selectedShort?.id ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</>
              ) : publishMode === "all" ? (
                <>
                  <Upload className="h-4 w-4" />
                  Upload {uploadCount === "all" ? `All ${unpublishedShorts.length}` : Math.min(uploadCount, unpublishedShorts.length)} Shorts
                  {uploadIntervalMinutes > 0 ? ` · ${uploadIntervalMinutes}min apart` : ""}
                </>
              ) : (
                <><Upload className="h-4 w-4" /> Upload Short</>
              )}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
