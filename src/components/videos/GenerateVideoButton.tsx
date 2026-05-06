"use client";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Sparkles, Loader2, Clock, Search, RefreshCw, FileText,
  CheckCircle, BookOpen, Lightbulb, PenLine, UploadCloud, TrendingUp,
} from "lucide-react";
import { GeneratedScript, ContentType } from "@/lib/claude";

const DURATIONS = [
  { value: "30",   label: "30 seconds",  sub: "Shorts / Reels" },
  { value: "60",   label: "1 minute",    sub: "Quick tip" },
  { value: "120",  label: "2 minutes",   sub: "Short-form" },
  { value: "180",  label: "3 minutes",   sub: "Standard" },
  { value: "300",  label: "5 minutes",   sub: "Medium" },
  { value: "600",  label: "10 minutes",  sub: "Long-form" },
  { value: "900",  label: "15 minutes",  sub: "Deep dive" },
  { value: "1800", label: "30 minutes",  sub: "Full episode" },
  { value: "3600", label: "60 minutes",  sub: "Podcast / Lecture" },
];

type Mode = "ai" | "custom";
type Step = "setup" | "researching" | "review-research" | "scripting" | "review-script" | "creating";

interface ResearchResult {
  research: string;
  angle: string;
  contentType: ContentType;
}

function StepIndicator({ current, mode }: { current: Step; mode: Mode }) {
  const steps = mode === "custom"
    ? [{ key: "setup", label: "Script" }, { key: "review-script", label: "Review" }, { key: "creating", label: "Create" }]
    : [{ key: "setup", label: "Duration" }, { key: "review-research", label: "Research" }, { key: "review-script", label: "Script" }, { key: "creating", label: "Create" }];

  const activeIndex = steps.findIndex((s) =>
    current === "researching" ? s.key === "review-research" :
    current === "scripting"   ? s.key === "review-script" :
    s.key === current
  );

  return (
    <div className="flex items-center gap-1 mb-4">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-1 flex-1">
          <div className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
            i < activeIndex ? "text-primary" : i === activeIndex ? "text-foreground" : "text-muted-foreground"
          }`}>
            <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors ${
              i < activeIndex ? "bg-primary border-primary text-primary-foreground" :
              i === activeIndex ? "border-foreground" : "border-muted-foreground/40"
            }`}>
              {i < activeIndex ? "✓" : i + 1}
            </span>
            <span className="hidden sm:inline">{s.label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`flex-1 h-px mx-1 transition-colors ${i < activeIndex ? "bg-primary" : "bg-border"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export interface GenerateVideoButtonHandle {
  openWithTopic: (topic: string) => void;
}

export const GenerateVideoButton = forwardRef<
  GenerateVideoButtonHandle,
  { seriesId: string; defaultDuration?: number }
>(function GenerateVideoButton({ seriesId, defaultDuration = 60 }, ref) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("ai");
  const [step, setStep] = useState<Step>("setup");
  const [duration, setDuration] = useState(String(defaultDuration));
  const [contentType, setContentType] = useState<ContentType>("story");
  const [research, setResearch] = useState<ResearchResult | null>(null);
  const [script, setScript] = useState<GeneratedScript | null>(null);
  const [overlayTitle, setOverlayTitle] = useState("");
  const [topicHint, setTopicHint] = useState("");
  // Custom script
  const [customText, setCustomText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const router = useRouter();

  useImperativeHandle(ref, () => ({
    openWithTopic(topic: string) {
      setTopicHint(topic);
      setOpen(true);
      setMode("ai");
      setStep("setup");
      setContentType("story");
      setResearch(null);
      setScript(null);
      setOverlayTitle("");
      setCustomText("");
    },
  }));

  function handleOpen() {
    setTopicHint("");
    setOpen(true);
    setMode("ai");
    setStep("setup");
    setContentType("story");
    setResearch(null);
    setScript(null);
    setOverlayTitle("");
    setCustomText("");
  }

  function handleClose() {
    if (step === "creating") return;
    setOpen(false);
  }

  // ── AI path ──────────────────────────────────────────────────────────────

  async function handleResearch() {
    setStep("researching");
    try {
      const res = await fetch(`/api/series/${seriesId}/research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType, ...(topicHint ? { topicHint } : {}) }),
      });
      if (!res.ok) throw new Error();
      const data: ResearchResult = await res.json();
      setResearch(data);
      setStep("review-research");
    } catch {
      toast.error("Research failed. Try again.");
      setStep("setup");
    }
  }

  async function handleGenerateScript() {
    if (!research) return;
    setStep("scripting");
    try {
      const res = await fetch(`/api/series/${seriesId}/script`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ research: research.research, angle: research.angle, duration: Number(duration), contentType: research.contentType }),
      });
      if (!res.ok) throw new Error();
      const data: { script: GeneratedScript } = await res.json();
      setScript(data.script);
      setOverlayTitle(data.script.overlayTitle || data.script.title || "");
      setStep("review-script");
    } catch {
      toast.error("Script generation failed. Try again.");
      setStep("review-research");
    }
  }

  // ── Custom script path ────────────────────────────────────────────────────

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCustomText((ev.target?.result as string) ?? "");
    reader.readAsText(file, "utf-8");
  }

  async function handlePreviewCustomScript() {
    if (!customText.trim()) { toast.error("Please paste or upload your script first"); return; }
    // Ask the series API to build the script object (no Claude — pure local parsing)
    const res = await fetch(`/api/series/${seriesId}/build-script`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawScript: customText }),
    });
    if (!res.ok) { toast.error("Failed to process script"); return; }
    const data: { script: GeneratedScript } = await res.json();
    setScript(data.script);
    setOverlayTitle(data.script.overlayTitle || data.script.title || "");
    setStep("review-script");
  }

  // ── Shared create step ────────────────────────────────────────────────────

  async function handleCreate() {
    if (!script) return;
    setStep("creating");

    const body: Record<string, unknown> = {
      duration: Number(duration),
      script: {
        ...script,
        overlayTitle: (overlayTitle || script.overlayTitle || script.title).trim(),
      },
      customScript: mode === "custom", // flag — skips research in pipeline
    };
    if (mode === "ai" && research) {
      body.research = research.research;
      body.angle = research.angle;
    }

    const res = await fetch(`/api/series/${seriesId}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = await res.json();
      setOpen(false);
      toast.success("Video creation started!");
      router.push(`/videos/${data.videoId}`);
      router.refresh();
    } else {
      toast.error("Failed to start video creation");
      setStep("review-script");
    }
  }

  return (
    <>
      <button onClick={handleOpen} className="btn-primary gap-2">
        <Sparkles className="h-4 w-4" />
        Generate Video
      </button>

      <Dialog open={open} onOpenChange={(o: boolean) => { if (!o) handleClose(); }}>
        <DialogContent className="flex flex-col max-h-[85vh] overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {step === "setup"           && "Create New Video"}
              {step === "researching"     && "Researching Topic..."}
              {step === "review-research" && "Review Research"}
              {step === "scripting"       && "Writing Script..."}
              {step === "review-script"   && "Review Script"}
              {step === "creating"        && "Creating Video..."}
            </DialogTitle>
            <DialogDescription>
              {step === "setup" && mode === "ai" && "Claude will research your topic, write a script, and you confirm before creating."}
              {step === "setup" && mode === "custom" && "Paste or upload your own script. It goes straight to ElevenLabs — no AI rewriting."}
              {step === "researching" && "Finding real facts, stories, names and dates..."}
              {step === "review-research" && "Review what Claude found. Retry for a different angle or continue."}
              {step === "scripting" && "Writing a script grounded in the research..."}
              {step === "review-script" && "Review the script, then confirm to create the video."}
              {step === "creating" && "Starting video production..."}
            </DialogDescription>
          </DialogHeader>

          <StepIndicator current={step} mode={mode} />

          <div className="overflow-y-auto flex-1 min-h-0 pr-1">

          {/* ── STEP 1: Mode selector + setup ── */}
          {step === "setup" && (
            <div className="space-y-5">
              {/* Mode toggle */}
              <div className="grid grid-cols-2 gap-3">
                {([
                  { key: "ai",     label: "AI Generate",   sub: "Research + write",  icon: Sparkles },
                  { key: "custom", label: "My Own Script", sub: "Paste or upload",   icon: PenLine },
                ] as const).map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setMode(m.key)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors text-center ${
                      mode === m.key ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40"
                    }`}
                  >
                    <m.icon className="h-5 w-5" />
                    <div>
                      <p className="text-sm font-semibold">{m.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{m.sub}</p>
                    </div>
                  </button>
                ))}
              </div>

              {/* AI mode options */}
              {mode === "ai" && (
                <>
                  {topicHint && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20 text-sm">
                      <TrendingUp className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-primary font-medium truncate" title={topicHint}>{topicHint}</span>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Content Type</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { value: "story" as ContentType, label: "Real Story", sub: "True events, documented cases", icon: BookOpen },
                        { value: "facts" as ContentType, label: "Facts",      sub: "Statistics, education, tips",  icon: Lightbulb },
                      ].map((t) => (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => setContentType(t.value)}
                          className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors text-center ${
                            contentType === t.value ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40"
                          }`}
                        >
                          <t.icon className="h-5 w-5" />
                          <div>
                            <p className="text-sm font-semibold">{t.label}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{t.sub}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2"><Clock className="h-4 w-4" /> Video Length</Label>
                    <Select value={duration} onValueChange={(value) => { if (value) setDuration(value); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DURATIONS.map((d) => (
                          <SelectItem key={d.value} value={d.value}>
                            <span className="font-medium">{d.label}</span>
                            <span className="text-muted-foreground ml-2 text-xs">— {d.sub}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {Number(duration) >= 600 && (
                    <p className="text-xs text-muted-foreground p-3 rounded-lg bg-muted/50">
                      Long videos take more time to generate — please be patient.
                    </p>
                  )}

                  <div className="flex gap-3 justify-end pt-1">
                    <button onClick={handleClose} className="btn-ghost">Cancel</button>
                    <button onClick={handleResearch} className="btn-primary">
                      <Search className="h-4 w-4" /> Research Topic
                    </button>
                  </div>
                </>
              )}

              {/* Custom script mode */}
              {mode === "custom" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Your Script</Label>
                    <div>
                      <input ref={fileRef} type="file" accept=".txt,.srt,.md" className="hidden" onChange={handleFileUpload} />
                      <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                        <UploadCloud className="h-3.5 w-3.5" /> Upload .txt
                      </button>
                    </div>
                  </div>
                  <Textarea
                    placeholder="Paste your script here…&#10;&#10;Split into paragraphs — each paragraph becomes one video segment."
                    className="min-h-[200px] text-sm font-mono leading-relaxed resize-y"
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {customText.trim().split(/\s+/).filter(Boolean).length} words — your script is passed directly to ElevenLabs, unchanged.
                  </p>
                  <div className="flex gap-3 justify-end">
                    <button onClick={handleClose} className="btn-ghost">Cancel</button>
                    <button onClick={handlePreviewCustomScript} disabled={!customText.trim()} className="btn-primary">
                      <FileText className="h-4 w-4" /> Preview & Continue
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Loading: Researching */}
          {step === "researching" && (
            <div className="py-10 flex flex-col items-center gap-4 text-center">
              <div className="relative">
                <div className="h-14 w-14 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                <Search className="h-5 w-5 text-primary absolute inset-0 m-auto" />
              </div>
              <div>
                <p className="font-medium">Claude is researching...</p>
                <p className="text-sm text-muted-foreground mt-1">Finding real facts, stories and documented events</p>
              </div>
            </div>
          )}

          {/* Review research */}
          {step === "review-research" && research && (
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Angle</p>
                <p className="text-sm font-medium text-primary">{research.angle}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Research Findings</p>
                <div className="max-h-52 overflow-y-auto rounded-lg border bg-muted/40 p-3 text-sm leading-relaxed whitespace-pre-wrap">
                  {research.research}
                </div>
              </div>
              <div className="flex gap-3 justify-between">
                <button onClick={handleResearch} className="btn-ghost">
                  <RefreshCw className="h-4 w-4" /> Different Angle
                </button>
                <button onClick={handleGenerateScript} className="btn-primary">
                  <FileText className="h-4 w-4" /> Write Script
                </button>
              </div>
            </div>
          )}

          {/* Loading: Scripting */}
          {step === "scripting" && (
            <div className="py-10 flex flex-col items-center gap-4 text-center">
              <div className="relative">
                <div className="h-14 w-14 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                <FileText className="h-5 w-5 text-primary absolute inset-0 m-auto" />
              </div>
              <div>
                <p className="font-medium">Writing your script...</p>
                <p className="text-sm text-muted-foreground mt-1">Building a unique script from the research</p>
              </div>
            </div>
          )}

          {/* Review script */}
          {step === "review-script" && script && (
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Title</p>
                <p className="font-semibold">{script.title}</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="overlay-title" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  On-screen Overlay Title
                </Label>
                <Input
                  id="overlay-title"
                  value={overlayTitle}
                  onChange={(e) => setOverlayTitle(e.target.value)}
                  placeholder="Text shown on top of the video"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Script — {script.segments.length} segments
                  {mode === "custom" && <span className="ml-2 text-green-500 normal-case font-normal">(your text, unchanged)</span>}
                </p>
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {script.segments.map((seg, i) => (
                    <div key={i} className="rounded-lg border bg-muted/30 p-3 space-y-1">
                      <p className="text-xs text-muted-foreground font-medium">Segment {i + 1}</p>
                      <p className="text-sm leading-relaxed">{seg.text}</p>
                      <p className="text-xs text-muted-foreground italic">🎬 {seg.visualDescription}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 justify-between">
                {mode === "ai" ? (
                  <button onClick={handleGenerateScript} className="btn-ghost">
                    <RefreshCw className="h-4 w-4" /> Rewrite Script
                  </button>
                ) : (
                  <button onClick={() => setStep("setup")} className="btn-ghost">
                    <RefreshCw className="h-4 w-4" /> Edit Script
                  </button>
                )}
                <button onClick={handleCreate} className="btn-primary">
                  <CheckCircle className="h-4 w-4" /> Confirm & Create Video
                </button>
              </div>
            </div>
          )}

          {/* Creating */}
          {step === "creating" && (
            <div className="py-10 flex flex-col items-center gap-4 text-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Starting video production...</p>
            </div>
          )}

          </div>{/* end scrollable area */}
        </DialogContent>
      </Dialog>
    </>
  );
});
