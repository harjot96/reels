import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Video, Settings, Scissors, ExternalLink, Download, Zap } from "lucide-react";
import { ShortsButton } from "@/components/videos/ShortsButton";
import { SeriesClientSection } from "@/components/series/SeriesClientSection";
import { formatDistanceToNow } from "date-fns";

const statusClass: Record<string, string> = {
  PUBLISHED: "status-pill status-pill-published",
  READY:     "status-pill status-pill-ready",
  GENERATING:"status-pill status-pill-generating",
  SCHEDULED: "status-pill status-pill-scheduled",
  FAILED:    "status-pill status-pill-failed",
  PENDING:   "status-pill status-pill-pending",
};

export default async function SeriesDetailPage({ params }: { params: { seriesId: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session!.user as { id: string }).id;

  const series = await prisma.series.findFirst({
    where: { id: params.seriesId, userId },
    include: {
      videos: {
        orderBy: { createdAt: "desc" },
        include: { job: true, shorts: { orderBy: { index: "asc" } } },
      },
    },
  });

  if (!series) notFound();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/series"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Series
          </Link>
          <span className="text-border">/</span>
          <div>
            <h1 className="page-title">{series.title}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{series.niche}</p>
          </div>
        </div>
        <Link
          href={`/series/${series.id}/settings`}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors shrink-0"
        >
          <Settings className="h-3.5 w-3.5" /> Settings
        </Link>
      </div>

      {/* Meta chips */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: "Style", value: series.style },
          { label: "Duration", value: `${series.videoDuration}s` },
          { label: "Format", value: series.videoFormat },
          { label: "Language", value: series.language === "hi" ? "Hindi" : "English" },
        ].map(({ label, value }) => (
          <span key={label} className="px-3 py-1 rounded-lg bg-secondary/60 text-xs">
            <span className="text-muted-foreground">{label}: </span>
            <span className="font-medium">{value}</span>
          </span>
        ))}
        {series.autoPublish && (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-green-500/10 text-green-400 text-xs font-medium">
            <Zap className="h-3 w-3" /> Auto-publish
          </span>
        )}
      </div>

      {/* Actions + Trending topics panel */}
      <SeriesClientSection
        seriesId={series.id}
        niche={series.niche}
        defaultDuration={series.videoDuration}
        logoUrl={series.logoUrl}
      />

      {/* Videos list */}
      <div>
        <h2 className="section-title mb-3 flex items-center gap-2">
          <Video className="h-4 w-4" />
          Videos
          <span className="text-muted-foreground font-normal text-sm">({series.videos.length})</span>
        </h2>

        {series.videos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 border rounded-xl bg-card/50 text-center">
            <Video className="h-8 w-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">No videos yet — use the buttons above to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {series.videos.map((video) => (
              <div key={video.id} className="rounded-xl border border-border bg-card p-4 space-y-3 hover:border-border/80 transition-colors">
                {/* Video row */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <Link href={`/videos/${video.id}`} className="font-medium text-sm hover:text-primary transition-colors truncate block">
                      {video.title}
                    </Link>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {formatDistanceToNow(new Date(video.createdAt), { addSuffix: true })}
                      {video.durationSeconds ? ` · ${Math.floor(video.durationSeconds / 60)}m ${video.durationSeconds % 60}s` : ""}
                    </p>
                    {(video.job?.currentStep === "GENERATING" || video.status === "GENERATING") && (
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="progress-bar w-32">
                          <div className="progress-bar-fill" style={{ width: `${video.job?.overallProgress ?? 0}%` }} />
                        </div>
                        <span className="text-[10px] text-primary">
                          {video.job?.stepMessage || "Generating…"} {video.job?.overallProgress ?? 0}%
                        </span>
                      </div>
                    )}
                  </div>
                  <span className={statusClass[video.status] ?? "status-pill status-pill-pending"}>
                    {(video.status === "GENERATING" || video.status === "PENDING") && <span className="live-dot" />}
                    {video.status.toLowerCase()}
                  </span>
                </div>

                {/* Action buttons for READY/PUBLISHED videos */}
                {(video.status === "READY" || video.status === "PUBLISHED") && video.videoUrl && (
                  <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/60">
                    <a href={video.videoUrl} download
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary/50 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                      <Download className="w-3 h-3" /> Download
                    </a>
                    {video.srtUrl && (
                      <a href={video.srtUrl} download
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary/50 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                        <Download className="w-3 h-3" /> Captions
                      </a>
                    )}
                    {video.youtubeUrl && (
                      <a href={video.youtubeUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary/50 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                        <ExternalLink className="w-3 h-3" /> YouTube
                      </a>
                    )}
                    <ShortsButton
                      videoId={video.id}
                      videoTitle={video.title}
                      durationSeconds={video.durationSeconds ?? 0}
                    />
                  </div>
                )}

                {/* Existing shorts */}
                {video.shorts.length > 0 && (
                  <div className="pt-2 border-t border-border/60">
                    <p className="text-[11px] text-muted-foreground mb-2 flex items-center gap-1">
                      <Scissors className="w-3 h-3" /> {video.shorts.length} shorts generated
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {video.shorts.map((short) => (
                        <div key={short.id} className="flex items-center gap-1">
                          <a href={short.url} download
                            className="flex items-center gap-1 px-2 py-0.5 rounded border border-border bg-secondary/50 text-xs font-medium hover:bg-secondary transition-colors">
                            Part {short.index + 1}
                          </a>
                          {short.youtubeUrl && (
                            <a href={short.youtubeUrl} target="_blank" rel="noopener noreferrer"
                              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
