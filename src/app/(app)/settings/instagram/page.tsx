"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Camera, Unlink, ExternalLink, CheckCircle2, Loader2 } from "lucide-react";

export default function InstagramSettingsPage() {
  const [account, setAccount] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings/instagram")
      .then((r) => r.json())
      .then((data) => { setAccount(data); setLoading(false); });

    const params = new URLSearchParams(window.location.search);
    if (params.get("success")) toast.success("Instagram connected successfully!");
    if (params.get("error")) toast.error(params.get("error") ?? "Failed to connect Instagram");
  }, []);

  async function handleDisconnect() {
    if (!confirm("Disconnect Instagram?")) return;
    await fetch("/api/settings/instagram", { method: "DELETE" });
    setAccount(null);
    toast.success("Instagram disconnected");
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title">Instagram Integration</h1>
        <p className="text-muted-foreground mt-1 text-sm">Connect your Business account to publish Reels</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Camera className="h-4 w-4 text-pink-500" />
          <p className="text-sm font-semibold">Instagram Business</p>
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
                  <p className="font-medium text-sm">@{account.username}</p>
                  <p className="text-[11px] text-muted-foreground">{account.pageName} · Page ID: {account.pageId}</p>
                </div>
              </div>
              <span className="status-pill status-pill-published">Connected</span>
            </div>
            <div className="flex gap-2">
              <a
                href={`https://www.instagram.com/${account.username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" /> View Profile
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
              Connect Instagram through Meta so you can publish generated videos as Reels.
            </p>
            <a href="/api/auth/instagram/connect" className="btn-primary inline-flex">
              <Camera className="h-4 w-4 text-pink-400" />
              Connect Instagram
            </a>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-sm font-semibold mb-3">Setup Instructions</p>
        <ol className="space-y-2 text-sm text-muted-foreground">
          {[
            "Create a Meta app in Meta for Developers",
            <>Add <strong className="text-foreground">Instagram Graph API</strong> + <strong className="text-foreground">Facebook Login</strong> products</>,
            <>Set OAuth redirect URI to <code className="text-foreground bg-secondary/70 px-1.5 py-0.5 rounded text-[11px]">http://localhost:3000/api/auth/instagram/callback</code></>,
            <>In Facebook Login → Permissions, add: <code className="text-foreground bg-secondary/70 px-1.5 py-0.5 rounded text-[11px]">instagram_content_publish, pages_show_list, pages_read_engagement</code></>,
            "Use an Instagram Business account linked to a Facebook Page",
            <>Set <code className="text-foreground bg-secondary/70 px-1.5 py-0.5 rounded text-[11px]">PUBLIC_BASE_URL</code> to a public HTTPS URL (e.g. ngrok) — required for Instagram to fetch the video</>,
          ].map((step, i) => (
            <li key={i} className="flex gap-3 list-none">
              <span className="text-primary shrink-0 font-semibold">{i + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <div className="mt-4 p-3 rounded-lg border border-border bg-secondary/20 text-xs text-muted-foreground">
          <strong className="text-foreground">Note:</strong> Clicking "Connect Instagram" opens a Facebook login dialog — this is normal. Instagram Business API authentication goes through Facebook OAuth.
        </div>
      </div>
    </div>
  );
}
