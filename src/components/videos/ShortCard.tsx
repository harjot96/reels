"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, RefreshCw, Check, X, Camera, ThumbsUp } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface ShortCardProps {
  short: any;
  publishingShort: string | null;
  publishingAllShorts: boolean;
  onPublish: (short: any) => void;
  onUpdated: (short: any) => void;
}

export function ShortCard({ short: initialShort, publishingShort, publishingAllShorts, onPublish, onUpdated }: ShortCardProps) {
  const [short, setShort] = useState(initialShort);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingCaption, setEditingCaption] = useState(false);
  const [titleValue, setTitleValue] = useState(short.overlayTitle || short.title || "");
  const [captionValue, setCaptionValue] = useState(short.overlayCaption || "");
  const [rendering, setRendering] = useState(false);
  const [publishingInstagram, setPublishingInstagram] = useState(false);
  const [publishingFacebook, setPublishingFacebook] = useState(false);
  const [facebookModalOpen, setFacebookModalOpen] = useState(false);
  const [facebookDescInput, setFacebookDescInput] = useState("");

  async function applyOverlay() {
    setRendering(true);
    setEditingTitle(false);
    setEditingCaption(false);
    try {
      const res = await fetch(`/api/shorts/${short.id}/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overlayTitle: titleValue, overlayCaption: captionValue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Render failed");
      const updated = { ...short, ...data.short };
      // Force video reload by appending timestamp
      updated.url = `${data.short.url}?t=${Date.now()}`;
      setShort(updated);
      onUpdated(updated);
      toast.success("Short re-rendered with new text!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to re-render");
    } finally {
      setRendering(false);
    }
  }

  async function publishInstagram() {
    if (publishingInstagram || rendering) return;
    setPublishingInstagram(true);
    try {
      const payload = {
        title: (titleValue || short.title || "").trim(),
        description: captionValue.trim(),
      };
      const res = await fetch(`/api/shorts/${short.id}/instagram`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Instagram upload failed");

      const updated = {
        ...short,
        title: data.title ?? short.title,
        instagramMediaId: data.instagramMediaId ?? short.instagramMediaId,
        instagramUrl: data.instagramUrl ?? short.instagramUrl,
      };
      setShort(updated);
      onUpdated(updated);
      toast.success("Uploaded to Instagram!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Instagram upload failed");
    } finally {
      setPublishingInstagram(false);
    }
  }

  async function publishFacebook() {
    if (publishingFacebook || rendering) return;
    setPublishingFacebook(true);
    setFacebookModalOpen(false);
    try {
      const payload = {
        title: (titleValue || short.title || "").trim(),
        description: facebookDescInput.trim(),
      };
      const res = await fetch(`/api/shorts/${short.id}/facebook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Facebook upload failed");

      const updated = {
        ...short,
        title: data.title ?? short.title,
        facebookPostId: data.facebookPostId ?? short.facebookPostId,
        facebookUrl: data.facebookUrl ?? short.facebookUrl,
      };
      setShort(updated);
      onUpdated(updated);
      toast.success("Uploaded to Facebook!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Facebook upload failed");
    } finally {
      setPublishingFacebook(false);
    }
  }

  return (
    <>
    <div className="border rounded-xl overflow-hidden bg-secondary/30 flex flex-col">
      {/* Video with editable overlay zones */}
      <div className="relative w-full aspect-[9/16] bg-black group">
        <video
          key={short.url}
          src={short.url}
          controls
          className="w-full h-full object-contain"
        />

        {/* Top title zone */}
        <div className="absolute top-0 left-0 right-0 h-[12%]">
          {editingTitle ? (
            <div className="absolute inset-0 flex items-center gap-1 px-1 bg-black/70">
              <input
                autoFocus
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") applyOverlay(); if (e.key === "Escape") setEditingTitle(false); }}
                className="flex-1 bg-transparent text-white text-[10px] outline-none border-b border-white/50 min-w-0"
                placeholder="Title text..."
                maxLength={60}
              />
              <button onClick={applyOverlay} className="text-green-400 hover:text-green-300 shrink-0"><Check className="w-3 h-3" /></button>
              <button onClick={() => setEditingTitle(false)} className="text-red-400 hover:text-red-300 shrink-0"><X className="w-3 h-3" /></button>
            </div>
          ) : (
            <button
              onClick={() => { setEditingTitle(true); setEditingCaption(false); }}
              className="absolute inset-0 flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 border-b border-dashed border-white/30"
            >
              <Pencil className="w-3 h-3 text-white/70" />
              <span className="text-white/70 text-[9px] font-medium">
                {titleValue || "Click to add title"}
              </span>
            </button>
          )}
        </div>

        {/* Bottom caption zone */}
        <div className="absolute bottom-0 left-0 right-0 h-[18%]">
          {editingCaption ? (
            <div className="absolute inset-0 flex items-center gap-1 px-1 bg-black/70">
              <input
                autoFocus
                value={captionValue}
                onChange={(e) => setCaptionValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") applyOverlay(); if (e.key === "Escape") setEditingCaption(false); }}
                className="flex-1 bg-transparent text-white text-[10px] outline-none border-b border-white/50 min-w-0"
                placeholder="Caption / hook text..."
                maxLength={60}
              />
              <button onClick={applyOverlay} className="text-green-400 hover:text-green-300 shrink-0"><Check className="w-3 h-3" /></button>
              <button onClick={() => setEditingCaption(false)} className="text-red-400 hover:text-red-300 shrink-0"><X className="w-3 h-3" /></button>
            </div>
          ) : (
            <button
              onClick={() => { setEditingCaption(true); setEditingTitle(false); }}
              className="absolute inset-0 flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 border-t border-dashed border-white/30"
            >
              <Pencil className="w-3 h-3 text-white/70" />
              <span className="text-white/70 text-[9px] font-medium">
                {captionValue || "Click to add caption"}
              </span>
            </button>
          )}
        </div>

        {/* Rendering overlay */}
        {rendering && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
            <span className="text-white text-[10px]">Re-rendering...</span>
          </div>
        )}
      </div>

      {/* Card info */}
      <div className="p-2 space-y-1.5">
        <p className="text-xs font-medium truncate">{short.title}</p>

        {/* Edit text fields (always visible below) */}
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <input
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              placeholder="Top title..."
              maxLength={60}
              className="flex-1 text-[10px] bg-muted/50 border border-border rounded px-1.5 py-0.5 outline-none focus:border-primary min-w-0"
            />
          </div>
          <div className="flex items-center gap-1">
            <input
              value={captionValue}
              onChange={(e) => setCaptionValue(e.target.value)}
              placeholder="Bottom caption..."
              maxLength={60}
              className="flex-1 text-[10px] bg-muted/50 border border-border rounded px-1.5 py-0.5 outline-none focus:border-primary min-w-0"
            />
            <button
              onClick={applyOverlay}
              disabled={rendering}
              title="Apply to video"
              className="shrink-0 p-0.5 rounded border border-primary/40 text-primary hover:bg-primary/10 disabled:opacity-50"
            >
              {rendering ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            </button>
          </div>
        </div>

        <div className="flex gap-1.5 flex-wrap">
          <a
            href={short.url}
            download
            className="text-xs px-2 py-0.5 rounded border border-border hover:border-primary hover:text-primary transition-colors"
          >
            ↓ Save
          </a>
          {!short.youtubeUrl ? (
            <button
              type="button"
              onClick={() => onPublish(short)}
              disabled={publishingShort === short.id || publishingAllShorts || rendering}
              className="text-xs px-2 py-0.5 rounded border border-primary/40 text-primary hover:bg-primary/10 transition-colors disabled:opacity-60"
            >
              {publishingShort === short.id ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Uploading
                </span>
              ) : "Upload"}
            </button>
          ) : (
            <a
              href={short.youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-2 py-0.5 rounded border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors"
            >
              ▶ YT
            </a>
          )}
          {!short.instagramUrl ? (
            <button
              type="button"
              onClick={publishInstagram}
              disabled={publishingInstagram || rendering}
              className="text-xs px-2 py-0.5 rounded border border-pink-500/40 text-pink-400 hover:bg-pink-500/10 transition-colors disabled:opacity-60"
            >
              {publishingInstagram ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> IG...
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <Camera className="h-3 w-3" /> IG
                </span>
              )}
            </button>
          ) : (
            <a
              href={short.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-2 py-0.5 rounded border border-pink-500/40 text-pink-400 hover:bg-pink-500/10 transition-colors"
            >
              ▶ IG
            </a>
          )}
          {!short.facebookUrl ? (
            <button
              type="button"
              onClick={() => setFacebookModalOpen(true)}
              disabled={publishingFacebook || rendering}
              className="text-xs px-2 py-0.5 rounded border border-blue-500/40 text-blue-400 hover:bg-blue-500/10 transition-colors disabled:opacity-60"
            >
              {publishingFacebook ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> FB...
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <ThumbsUp className="h-3 w-3" /> FB
                </span>
              )}
            </button>
          ) : (
            <a
              href={short.facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-2 py-0.5 rounded border border-blue-500/40 text-blue-400 hover:bg-blue-500/10 transition-colors"
            >
              ▶ FB
            </a>
          )}
        </div>
      </div>
    </div>

    {/* Facebook description modal */}
    <Dialog open={facebookModalOpen} onOpenChange={setFacebookModalOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ThumbsUp className="h-4 w-4 text-blue-400" /> Share to Facebook
          </DialogTitle>
          <DialogDescription>
            Add a description for your Facebook post. Hashtags will be added automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Description (optional)</Label>
            <Textarea
              value={facebookDescInput}
              onChange={(e) => setFacebookDescInput(e.target.value)}
              placeholder="Write something about this video…"
              className="min-h-[100px] text-sm"
              disabled={publishingFacebook}
            />
          </div>
          <button
            className="btn-primary w-full justify-center"
            onClick={publishFacebook}
            disabled={publishingFacebook}
          >
            {publishingFacebook
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</>
              : <><ThumbsUp className="h-4 w-4" /> Publish to Facebook</>}
          </button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
