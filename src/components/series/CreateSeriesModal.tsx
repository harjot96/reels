"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Sparkles, Loader2 } from "lucide-react";

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi (हिंदी)" },
  { value: "pa", label: "Punjabi (ਪੰਜਾਬੀ)" },
];

const VOICES_BY_LANGUAGE: Record<string, { id: string; name: string }[]> = {
  en: [
    { id: "EXAVITQu4vr4xnSDxMaL", name: "Rachel (Female, Calm)" },
    { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh (Male, Deep)" },
    { id: "VR6AewLTigWG4xSOukaG", name: "Arnold (Male, Narrator)" },
    { id: "pNInz6obpgDQGcFmaJgB", name: "Adam (Male, Narration)" },
  ],
  hi: [
    { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam (Male, Multilingual)" },
    { id: "XB0fDUnXU5powFXDhCwa", name: "Charlotte (Female, Multilingual)" },
    { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice (Female, Multilingual)" },
    { id: "iP95p4xoKVk53GoZ742B", name: "Chris (Male, Multilingual)" },
  ],
  pa: [
    { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam (Male, Multilingual)" },
    { id: "XB0fDUnXU5powFXDhCwa", name: "Charlotte (Female, Multilingual)" },
    { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice (Female, Multilingual)" },
    { id: "iP95p4xoKVk53GoZ742B", name: "Chris (Male, Multilingual)" },
  ],
};

const STYLES = [
  { value: "cinematic", label: "Cinematic" },
  { value: "minimal", label: "Minimal" },
  { value: "documentary", label: "Documentary" },
  { value: "dramatic", label: "Dramatic" },
];

const IMAGE_STYLES = [
  { value: "photorealistic", label: "Photorealistic" },
  { value: "cinematic photography", label: "Cinematic Photography" },
  { value: "oil painting", label: "Oil Painting" },
  { value: "digital art", label: "Digital Art" },
  { value: "anime style", label: "Anime Style" },
];

interface CreateSeriesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateSeriesModal({ open, onOpenChange }: CreateSeriesModalProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    niche: "",
    description: "",
    language: "en",
    videoFormat: "landscape",
    style: "cinematic",
    voiceId: "EXAVITQu4vr4xnSDxMaL",
    ttsProvider: "auto",
    imageStyle: "photorealistic",
    videoDuration: 60,
    autoPublish: false,
    publishSchedule: "",
  });

  const voices = VOICES_BY_LANGUAGE[form.language] ?? VOICES_BY_LANGUAGE["en"];

  const update = (field: string, value: string | number | boolean | null) =>
    setForm((prev) => ({ ...prev, [field]: value ?? "" }));

  const updateLanguage = (lang: string | null) => {
    if (!lang) return;
    const defaultVoice = VOICES_BY_LANGUAGE[lang]?.[0]?.id ?? "EXAVITQu4vr4xnSDxMaL";
    setForm((prev) => ({ ...prev, language: lang, voiceId: defaultVoice }));
  };

  function handleClose() {
    onOpenChange(false);
    setStep(1);
    setForm({
      title: "", niche: "", description: "", language: "en",
      videoFormat: "landscape", style: "cinematic",
      voiceId: "EXAVITQu4vr4xnSDxMaL", ttsProvider: "auto",
      imageStyle: "photorealistic", videoDuration: 60,
      autoPublish: false, publishSchedule: "",
    });
  }

  async function handleSubmit() {
    setLoading(true);
    const res = await fetch("/api/series", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setLoading(false);
    if (res.ok) {
      const data = await res.json();
      toast.success("Series created!");
      handleClose();
      router.push(`/series/${data.id}`);
    } else {
      toast.error("Failed to create series");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle>New Series</DialogTitle>
          <DialogDescription>Set up your video series in a few steps.</DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-border">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  step > s
                    ? "bg-primary text-primary-foreground"
                    : step === s
                    ? "bg-primary/20 text-primary border border-primary"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {step > s ? <Check className="h-4 w-4" /> : s}
              </div>
              {s < 3 && <div className={`h-0.5 w-12 ${step > s ? "bg-primary" : "bg-secondary"}`} />}
            </div>
          ))}
          <span className="ml-2 text-sm text-muted-foreground">
            {step === 1 ? "Basic Info" : step === 2 ? "Visual Style" : "Publishing"}
          </span>
        </div>

        <div className="px-6 pb-6 pt-4">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <p className="font-semibold mb-0.5">Basic Information</p>
                <p className="text-sm text-muted-foreground">What is this series about?</p>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="modal-title">Series Title</Label>
                  <Input
                    id="modal-title"
                    placeholder="e.g. Stoic Wisdom Daily"
                    value={form.title}
                    onChange={(e) => update("title", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="modal-niche">Niche / Topic</Label>
                  <Input
                    id="modal-niche"
                    placeholder="e.g. Stoic philosophy quotes and lessons"
                    value={form.niche}
                    onChange={(e) => update("niche", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Be specific — this drives the AI script generation</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="modal-desc">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Textarea
                    id="modal-desc"
                    placeholder="Brief description of your channel's purpose"
                    value={form.description}
                    onChange={(e) => update("description", e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Video Language</Label>
                  <Select value={form.language} onValueChange={updateLanguage}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((l) => (
                        <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Script and voiceover will be generated in this language</p>
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setStep(2)}
                  disabled={!form.title || !form.niche}
                  className="btn-primary gap-2"
                >
                  Next <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <p className="font-semibold mb-0.5">Visual Style</p>
                <p className="text-sm text-muted-foreground">Configure how your videos look and sound</p>
              </div>
              <div className="space-y-4">
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Video Style</Label>
                    <Select value={form.style} onValueChange={(v) => update("style", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STYLES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Image Style</Label>
                    <Select value={form.imageStyle} onValueChange={(v) => update("imageStyle", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {IMAGE_STYLES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Voice</Label>
                  <Select value={form.voiceId} onValueChange={(v) => update("voiceId", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {voices.map((v) => (
                        <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>TTS Provider (Audio Engine)</Label>
                  <Select value={form.ttsProvider} onValueChange={(v) => update("ttsProvider", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto (best available)</SelectItem>
                      <SelectItem value="edge">Edge TTS — Free, Microsoft Neural</SelectItem>
                      <SelectItem value="elevenlabs">ElevenLabs — Best quality (paid)</SelectItem>
                      <SelectItem value="openai">OpenAI TTS — Great quality (paid)</SelectItem>
                      <SelectItem value="huggingface">HuggingFace — Free with API key</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Edge TTS is free and works without any API key.</p>
                </div>
                <div className="space-y-2">
                  <Label>Target Duration (seconds)</Label>
                  <Select value={String(form.videoDuration)} onValueChange={(v) => update("videoDuration", Number(v))}>
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
              </div>
              <div className="flex justify-between pt-2">
                <button onClick={() => setStep(1)} className="btn-ghost gap-2">
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <button onClick={() => setStep(3)} className="btn-primary gap-2">
                  Next <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <p className="font-semibold mb-0.5">Publishing Settings</p>
                <p className="text-sm text-muted-foreground">Configure auto-publishing to YouTube</p>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                  <div>
                    <p className="font-medium">Auto-publish to YouTube</p>
                    <p className="text-sm text-muted-foreground">
                      Automatically upload generated videos to your YouTube channel
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => update("autoPublish", !form.autoPublish)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      form.autoPublish ? "bg-primary" : "bg-secondary"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        form.autoPublish ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
                {form.autoPublish && (
                  <div className="space-y-2">
                    <Label>Publish Schedule (Cron)</Label>
                    <Input
                      placeholder="e.g. 0 9 * * * (daily at 9am)"
                      value={form.publishSchedule}
                      onChange={(e) => update("publishSchedule", e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Leave empty to publish immediately after generation</p>
                  </div>
                )}
              </div>
              <div className="flex justify-between pt-2">
                <button onClick={() => setStep(2)} className="btn-ghost gap-2">
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <button onClick={handleSubmit} disabled={loading} className="btn-primary gap-2">
                  {loading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</>
                  ) : (
                    <><Sparkles className="h-4 w-4" /> Create Series</>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
