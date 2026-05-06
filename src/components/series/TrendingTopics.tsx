"use client";

import { useState } from "react";
import { toast } from "sonner";
import { TrendingUp, Loader2, RefreshCw, Lightbulb } from "lucide-react";

interface TrendingTopicsProps {
  seriesId: string;
  niche: string;
  onUseTopic?: (topic: string) => void;
}

export function TrendingTopics({ seriesId, niche, onUseTopic }: TrendingTopicsProps) {
  const [topics, setTopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);

  async function fetchTopics(pageToken?: string) {
    setLoading(true);
    try {
      const url = pageToken
        ? `/api/series/${seriesId}/trending?pageToken=${encodeURIComponent(pageToken)}`
        : `/api/series/${seriesId}/trending`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to fetch trends");
      setTopics(data.topics ?? []);
      setNextPageToken(data.nextPageToken ?? undefined);
      setLoaded(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load trends (YouTube not connected?)");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-green-500" />
          <span className="text-sm font-medium">Trending in &ldquo;{niche}&rdquo; this week</span>
        </div>
        <button
          onClick={() => fetchTopics(loaded ? nextPageToken : undefined)}
          disabled={loading}
          className="btn-ghost text-xs py-1 px-2 gap-1.5"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          {loaded ? "Refresh" : "Load Trends"}
        </button>
      </div>

      {!loaded && !loading && (
        <p className="text-sm text-muted-foreground">
          See what&apos;s trending on YouTube in your niche to find high-view topic ideas.
        </p>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Searching YouTube for trending topics…
        </div>
      )}

      {loaded && topics.length === 0 && (
        <p className="text-sm text-muted-foreground">No trending topics found. Try refreshing.</p>
      )}

      {loaded && topics.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Lightbulb className="w-3 h-3" />
            {onUseTopic ? "Click a topic to use it for your next video" : "Click a topic to copy it"}
          </p>
          <div className="flex flex-col gap-1.5">
            {topics.map((topic, i) => (
              <div key={i} className="flex items-center gap-2 group">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(topic);
                    toast.success("Copied!");
                  }}
                  className="text-left flex-1 min-w-0 px-3 py-2 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/60 transition-colors"
                  title={topic}
                >
                  <span className="text-xs text-muted-foreground font-mono mr-2">#{i + 1}</span>
                  <span className="text-sm truncate">{topic}</span>
                </button>
                {onUseTopic && (
                  <button
                    onClick={() => onUseTopic(topic)}
                    className="shrink-0 text-xs text-primary font-medium px-2 py-1.5 rounded-md border border-primary/30 hover:bg-primary hover:text-primary-foreground transition-colors opacity-0 group-hover:opacity-100"
                  >
                    Use for video
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
