"use client";
import { useEffect, useState } from "react";
import { Users, Eye, ThumbsUp, PlayCircle, TrendingUp, Lightbulb, ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";

const GROWTH_TIPS = [
  { tip: "Post Shorts consistently", detail: "3–5 Shorts/week get 3× more impressions than long videos in early growth." },
  { tip: "Hook in the first 3 seconds", detail: "YouTube ranks by retention. Start with a surprising fact immediately." },
  { tip: "Use keywords in your title", detail: "Research search intent. Add the exact phrase in title, description, and first hashtag." },
  { tip: "Reply to every comment", detail: "Comments boost ranking signals. Responding in the first hour doubles engagement." },
  { tip: "Post at peak hours", detail: "Upload 2–3 hours before your audience's prime time (usually 6–9 PM local)." },
  { tip: "Create playlist series", detail: "Playlists increase watch time by auto-playing related videos — a key ranking factor." },
  { tip: "End screen + subscribe CTA", detail: "Ask viewers to subscribe at the 80% mark when they're most engaged." },
];

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

export default function YouTubeAnalytics() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/youtube/analytics")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setData({ connected: false }); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="skeleton h-28 rounded-xl" />
        <div className="skeleton h-40 rounded-xl" />
        <div className="skeleton h-32 rounded-xl" />
      </div>
    );
  }

  if (!data?.connected) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 bg-card/40 p-6 text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto">
          <PlayCircle className="h-6 w-6 text-red-400" />
        </div>
        <div>
          <p className="font-semibold text-sm">YouTube not connected</p>
          <p className="text-xs text-muted-foreground mt-1">Connect your channel to see analytics</p>
        </div>
        <Link href="/settings/youtube"
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium transition-colors">
          Connect YouTube →
        </Link>
      </div>
    );
  }

  if (data.error) {
    return (
      <div className="rounded-xl border border-border bg-card/40 p-4 text-sm text-muted-foreground">
        Could not load analytics: {data.error}
      </div>
    );
  }

  const { channel, videos } = data;
  const totalVideoViews = videos.reduce((a: number, v: any) => a + v.views, 0);

  return (
    <div className="space-y-4">
      {/* Channel card */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div className="flex items-center gap-2">
          <PlayCircle className="h-4 w-4 text-red-500 shrink-0" />
          <p className="text-sm font-semibold">YouTube Performance</p>
        </div>

        <div className="flex items-center gap-3 pb-3 border-b border-border/60">
          {channel.thumbnail
            ? <img src={channel.thumbnail} alt={channel.channelName} className="h-9 w-9 rounded-full ring-2 ring-border/60" />
            : <div className="h-9 w-9 rounded-full bg-red-500/15 flex items-center justify-center"><PlayCircle className="h-4 w-4 text-red-400" /></div>}
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{channel.channelName}</p>
            <a href={`https://www.youtube.com/channel/${channel.channelId}`} target="_blank" rel="noopener noreferrer"
              className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors">
              View channel <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: Users, value: fmt(channel.subscribers), label: "Subs", color: "text-violet-400" },
            { icon: Eye,   value: fmt(channel.totalViews),  label: "Views", color: "text-sky-400" },
            { icon: PlayCircle, value: fmt(channel.totalVideos), label: "Videos", color: "text-red-400" },
          ].map(({ icon: Icon, value, label, color }) => (
            <div key={label} className="text-center p-2.5 rounded-lg bg-secondary/40">
              <Icon className={`h-3.5 w-3.5 mx-auto mb-1.5 ${color}`} />
              <p className="text-lg font-bold tabular-nums">{value}</p>
              <p className="text-[10px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent videos */}
      {videos.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500 shrink-0" />
              <p className="text-sm font-semibold">Recent Videos</p>
            </div>
            <span className="text-[11px] text-muted-foreground bg-secondary/60 px-2 py-0.5 rounded-full">
              {fmt(totalVideoViews)} views
            </span>
          </div>
          <div className="space-y-1.5">
            {videos.map((v: any) => (
              <a key={v.id} href={v.youtubeUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-secondary/50 transition-colors group">
                {v.thumbnail && (
                  <img src={v.thumbnail} alt={v.title} className="h-9 w-14 rounded-md object-cover shrink-0 ring-1 ring-border/40" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate group-hover:text-primary transition-colors">{v.title}</p>
                  <div className="flex items-center gap-2.5 mt-0.5 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Eye className="h-2.5 w-2.5" />{fmt(v.views)}</span>
                    <span className="flex items-center gap-1"><ThumbsUp className="h-2.5 w-2.5" />{fmt(v.likes)}</span>
                  </div>
                </div>
                <ExternalLink className="h-3 w-3 text-muted-foreground/40 shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Growth tips */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-400 shrink-0" />
          <p className="text-sm font-semibold">Grow Faster</p>
        </div>
        <div className="space-y-2">
          {GROWTH_TIPS.slice(0, 4).map((item, i) => (
            <div key={i} className="flex gap-2.5 p-2.5 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
              <span className="flex-shrink-0 h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                style={{ background: "hsl(var(--primary)/18%)", color: "hsl(var(--primary))" }}>
                {i + 1}
              </span>
              <div>
                <p className="text-xs font-semibold leading-tight">{item.tip}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
