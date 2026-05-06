"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PlayCircle, Unlink, ExternalLink, CheckCircle2, Loader2, Save } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default function YoutubeSettingsPage() {
  const [account, setAccount] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [defaultDescription, setDefaultDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings/youtube")
      .then((r) => r.json())
      .then((data) => {
        setAccount(data);
        setDefaultDescription(data?.defaultDescription ?? "");
        setLoading(false);
      });

    const params = new URLSearchParams(window.location.search);
    if (params.get("success")) toast.success("YouTube connected successfully!");
    if (params.get("error")) toast.error(params.get("error") ?? "Failed to connect YouTube");
  }, []);

  async function handleSaveDescription() {
    setSaving(true);
    try {
      await fetch("/api/settings/youtube", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultDescription }),
      });
      toast.success("Default description saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm("Disconnect YouTube? Auto-publish will stop.")) return;
    await fetch("/api/settings/youtube", { method: "DELETE" });
    setAccount(null);
    toast.success("YouTube disconnected");
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title">YouTube Integration</h1>
        <p className="text-muted-foreground mt-1 text-sm">Connect your channel to enable auto-publishing</p>
      </div>

      {/* Connection card */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <PlayCircle className="h-4 w-4 text-red-500" />
          <p className="text-sm font-semibold">YouTube Channel</p>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : account ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg border border-green-500/20 bg-green-500/5">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
                <div>
                  <p className="font-medium text-sm">{account.channelName}</p>
                  <p className="text-[11px] text-muted-foreground">Channel ID: {account.channelId}</p>
                </div>
              </div>
              <span className="status-pill status-pill-published">Connected</span>
            </div>
            <div className="flex gap-2">
              <a
                href={`https://www.youtube.com/channel/${account.channelId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" /> View Channel
              </a>
              <button
                onClick={handleDisconnect}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-sm font-medium hover:bg-destructive/20 transition-colors"
              >
                <Unlink className="h-3.5 w-3.5" /> Disconnect
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Connect your YouTube account to automatically publish generated videos.
              You&apos;ll need to set up OAuth credentials in Google Cloud Console first.
            </p>
            <a href="/api/auth/youtube/connect" className="btn-primary inline-flex">
              <PlayCircle className="h-4 w-4 text-red-400" />
              Connect YouTube
            </a>
          </div>
        )}
      </div>

      {/* Default description */}
      {account && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div>
            <Label className="text-sm font-semibold">Default Video Description</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Used when no description is provided at publish time.
            </p>
          </div>
          <Textarea
            value={defaultDescription}
            onChange={(e) => setDefaultDescription(e.target.value)}
            placeholder="Enter a default description for all uploaded videos…"
            className="min-h-[120px] text-sm"
          />
          <button
            onClick={handleSaveDescription}
            disabled={saving}
            className="btn-primary flex items-center gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      )}

      {/* Setup instructions */}
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-sm font-semibold mb-3">Setup Instructions</p>
        <ol className="space-y-2 text-sm text-muted-foreground list-none">
          {[
            "Go to Google Cloud Console and create a project",
            "Enable the YouTube Data API v3",
            "Create OAuth 2.0 credentials (Web application type)",
            <>Add <code className="text-foreground bg-secondary/70 px-1.5 py-0.5 rounded text-[11px]">http://localhost:3000/api/auth/youtube/callback</code> as authorized redirect URI</>,
            <>Copy Client ID and Secret to your <code className="text-foreground bg-secondary/70 px-1.5 py-0.5 rounded text-[11px]">.env.local</code></>,
            `Click "Connect YouTube" above`,
          ].map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="text-primary shrink-0 font-semibold">{i + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
