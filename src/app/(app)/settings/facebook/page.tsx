"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ThumbsUp, Unlink, ExternalLink, CheckCircle2, Loader2 } from "lucide-react";

export default function FacebookSettingsPage() {
  const [account, setAccount] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings/facebook")
      .then((r) => r.json())
      .then((data) => { setAccount(data); setLoading(false); });

    const params = new URLSearchParams(window.location.search);
    if (params.get("success")) toast.success("Facebook connected successfully!");
    if (params.get("error")) toast.error(params.get("error") ?? "Failed to connect Facebook");
  }, []);

  async function handleDisconnect() {
    if (!confirm("Disconnect Facebook?")) return;
    await fetch("/api/settings/facebook", { method: "DELETE" });
    setAccount(null);
    toast.success("Facebook disconnected");
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title">Facebook Integration</h1>
        <p className="text-muted-foreground mt-1 text-sm">Connect your Page to publish generated videos</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <ThumbsUp className="h-4 w-4 text-blue-500" />
          <p className="text-sm font-semibold">Facebook Page</p>
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
                  <p className="font-medium text-sm">{account.pageName}</p>
                  <p className="text-[11px] text-muted-foreground">Page ID: {account.pageId}</p>
                </div>
              </div>
              <span className="status-pill status-pill-published">Connected</span>
            </div>
            <div className="flex gap-2">
              {account.pageUrl && (
                <a
                  href={account.pageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> View Page
                </a>
              )}
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
              Connect Facebook so you can publish generated videos directly to your Page.
            </p>
            <a href="/api/auth/facebook/connect" className="btn-primary inline-flex">
              <ThumbsUp className="h-4 w-4 text-blue-400" />
              Connect Facebook
            </a>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-sm font-semibold mb-3">Setup Instructions</p>
        <ol className="space-y-2 text-sm text-muted-foreground">
          {[
            "Create a Meta app in Meta for Developers",
            "Add Facebook Login",
            <>Set OAuth redirect URI to <code className="text-foreground bg-secondary/70 px-1.5 py-0.5 rounded text-[11px]">http://localhost:3000/api/auth/facebook/callback</code></>,
            <>Grant permissions: <code className="text-foreground bg-secondary/70 px-1.5 py-0.5 rounded text-[11px]">pages_show_list, pages_read_engagement, pages_manage_posts</code></>,
            <>Set <code className="text-foreground bg-secondary/70 px-1.5 py-0.5 rounded text-[11px]">PUBLIC_BASE_URL</code> to a public HTTPS domain for media fetch</>,
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
