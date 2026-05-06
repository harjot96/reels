import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Plus, Film, Video, ChevronRight, Zap } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default async function SeriesPage() {
  const session = await getServerSession(authOptions);
  const userId = (session!.user as { id: string }).id;

  const seriesList = await prisma.series.findMany({
    where: { userId, status: { not: "ARCHIVED" } },
    include: { _count: { select: { videos: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Series</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {seriesList.length} series{seriesList.length !== 1 ? "" : ""}
          </p>
        </div>
        <Link
          href="/series/new"
          className="btn-primary"
        >
          <Plus className="h-4 w-4" />
          New Series
        </Link>
      </div>

      {seriesList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 border rounded-xl bg-card/50 text-center">
          <div className="w-16 h-16 rounded-2xl bg-secondary/60 flex items-center justify-center mb-4">
            <Film className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <p className="font-semibold">No series yet</p>
          <p className="text-sm text-muted-foreground mt-1 mb-6">Create your first faceless AI video series</p>
          <Link href="/series/new" className="btn-primary">
            <Plus className="h-4 w-4" />
            Create Series
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {seriesList.map((series) => (
            <Link
              key={series.id}
              href={`/series/${series.id}`}
              className="block p-5 rounded-xl border border-border bg-card hover:bg-secondary/30 hover:border-border/80 transition-all duration-150 group"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3 gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                    {series.title}
                  </h3>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{series.niche}</p>
                </div>
                <span className={`status-pill shrink-0 ${series.status === "ACTIVE" ? "status-pill-published" : "status-pill-pending"}`}>
                  {series.status.toLowerCase()}
                </span>
              </div>

              {/* Meta row */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-3">
                <span className="flex items-center gap-1">
                  <Video className="h-3 w-3" />
                  {series._count.videos} video{series._count.videos !== 1 ? "s" : ""}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-secondary/70 text-[10px] font-medium">
                  {series.videoDuration}s
                </span>
                {series.autoPublish && (
                  <span className="flex items-center gap-1 text-green-400">
                    <Zap className="h-3 w-3" />
                    Auto-publish
                  </span>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/60">
                <span className="text-[11px] text-muted-foreground">
                  {formatDistanceToNow(new Date(series.createdAt), { addSuffix: true })}
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
