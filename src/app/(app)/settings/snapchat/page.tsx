"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Ghost, Unlink, CheckCircle2, Loader2 } from "lucide-react";

export default function SnapchatSettingsPage() {
  const [account, setAccount] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings/snapchat")
      .then((r) => r.json())
      .then((data) => { setAccount(data); setLoading(false); });

    const params = new URLSearchParams(window.location.search);
    if (params.get("success")) toast.success("Snapchat connected successfully!");
    if (params.get("error")) toast.error(params.get("error") ?? "Failed to connect Snapchat");
  }, []);

  async function handleDisconnect() {
    if (!confirm("Disconnect Snapchat?")) return;
    await fetch("/api/settings/snapchat", { method: "DELETE" });
    setAccount(null);
    toast.success("Snapchat disconnected");
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title">Snapchat Integration</h1>
        <p className="text-muted-foreground mt-1 text-sm">Connect your Snapchat account to publish to Spotlight</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Ghost className="h-4 w-4 text-yellow-400" />
          <p className="text-sm font-semibold">Snapchat Account</p>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : account?.snapUserId ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg border border-green-500/20 bg-green-500/5">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
                <div>
                  <p className="font-medium text-sm">{account.displayName || account.username || "Snapchat User"}</p>
                  {account.username && <p className="text-[11px] text-muted-foreground">@{account.username}</p>}
                </div>
              </div>
              <span className="status-pill status-pill-published">Connected</span>
            </div>
            <button
              onClick={handleDisconnect}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-sm font-medium hover:bg-destructive/20 transition-colors"
            >
              <Unlink className="h-3.5 w-3.5" /> Disconnect
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Connect your Snapchat account to automatically publish generated videos to Spotlight.
            </p>
            <a href="/api/auth/snapchat/connect" className="btn-primary inline-flex">
              <Ghost className="h-4 w-4 text-yellow-400" />
              Connect Snapchat
            </a>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-sm font-semibold mb-3">Setup Instructions</p>
        <ol className="space-y-2 text-sm text-muted-foreground">
          {[
            "Create an app in the Snap Kit Developer Portal",
            "Add the Marketing API / Snapchat Ads scope",
            <>Set OAuth redirect URI to <code className="text-foreground bg-secondary/70 px-1.5 py-0.5 rounded text-[11px]">http://localhost:3000/api/auth/snapchat/callback</code></>,
            <>Copy Client ID and Secret into your <code className="text-foreground bg-secondary/70 px-1.5 py-0.5 rounded text-[11px]">.env</code> as <code className="text-foreground bg-secondary/70 px-1.5 py-0.5 rounded text-[11px]">SNAPCHAT_CLIENT_ID</code> and <code className="text-foreground bg-secondary/70 px-1.5 py-0.5 rounded text-[11px]">SNAPCHAT_CLIENT_SECRET</code></>,
            `Click "Connect Snapchat" above`,
          ].map((step, i) => (
            <li key={i} className="flex gap-3 list-none">
              <span className="text-primary shrink-0 font-semibold">{i + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
