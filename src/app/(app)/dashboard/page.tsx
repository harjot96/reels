import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Film, Video, PlayCircle, CalendarClock, ArrowRight } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import YouTubeAnalytics from "@/components/dashboard/YouTubeAnalytics";
import DashboardEmptyState from "@/components/dashboard/DashboardEmptyState";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const userId = (session!.user as { id: string }).id;

  const [totalSeries, videoStats, recentVideos] = await Promise.all([
    prisma.series.count({ where: { userId, status: { not: "ARCHIVED" } } }),
    prisma.video.groupBy({ by: ["status"], where: { series: { userId } }, _count: true }),
    prisma.video.findMany({
      where: { series: { userId } },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { series: { select: { title: true } }, job: { select: { overallProgress: true, stepMessage: true } } },
    }),
  ]);

  const statusMap = Object.fromEntries(videoStats.map((s) => [s.status, s._count]));
  const totalVideos = videoStats.reduce((a, s) => a + s._count, 0);

  const stats = [
    { label: "Series", value: totalSeries,             icon: Film,         gradient: "from-purple-500/20 to-purple-500/5", iconColor: "text-purple-400", border: "border-purple-500/20" },
    { label: "Videos", value: totalVideos,             icon: Video,        gradient: "from-blue-500/20 to-blue-500/5",   iconColor: "text-blue-400",   border: "border-blue-500/20" },
    { label: "Published", value: statusMap.PUBLISHED || 0, icon: PlayCircle, gradient: "from-green-500/20 to-green-500/5", iconColor: "text-green-400",  border: "border-green-500/20" },
    { label: "Scheduled", value: statusMap.SCHEDULED || 0, icon: CalendarClock, gradient: "from-amber-500/20 to-amber-500/5", iconColor: "text-amber-400", border: "border-amber-500/20" },
  ];

  const statusClass: Record<string, string> = {
    PUBLISHED: "status-pill status-pill-published",
    READY:     "status-pill status-pill-ready",
    GENERATING:"status-pill status-pill-generating",
    SCHEDULED: "status-pill status-pill-scheduled",
    FAILED:    "status-pill status-pill-failed",
    PENDING:   "status-pill status-pill-pending",
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Welcome back, <span className="text-foreground font-medium">{session?.user?.name}</span>
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, gradient, iconColor, border }) => (
          <div key={label} className={`stat-card border ${border}`}>
            <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${gradient} pointer-events-none`} />
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</span>
                <div className={`p-1.5 rounded-lg bg-black/20`}>
                  <Icon className={`h-4 w-4 ${iconColor}`} />
                </div>
              </div>
              <p className="text-3xl font-bold tabular-nums">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent Videos */}
        <div className="xl:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="section-title">Recent Videos</h2>
            <Link href="/videos" className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {recentVideos.length === 0 ? (
            <DashboardEmptyState />
          ) : (
            <div className="space-y-2">
              {recentVideos.map((video) => {
                const isGenerating = video.status === "GENERATING" || video.status === "PENDING";
                const progress = video.job?.overallProgress ?? 0;
                return (
                  <Link
                    key={video.id}
                    href={`/videos/${video.id}`}
                    className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-secondary/40 hover:border-border/80 transition-all duration-150 group"
                  >
                    {/* Thumbnail placeholder */}
                    <div className="w-12 h-9 rounded-md bg-secondary/70 flex items-center justify-center shrink-0 overflow-hidden">
                      <Video className="h-4 w-4 text-muted-foreground/50" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">{video.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {video.series.title} · {formatDistanceToNow(new Date(video.createdAt), { addSuffix: true })}
                      </p>
                      {isGenerating && (
                        <div className="mt-1.5 space-y-1">
                          <div className="progress-bar w-32">
                            <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                          </div>
                          <p className="text-[10px] text-primary">
                            {video.job?.stepMessage || "Generating…"} {progress}%
                          </p>
                        </div>
                      )}
                    </div>
                    <span className={statusClass[video.status] ?? "status-pill status-pill-pending"}>
                      {isGenerating && <span className="live-dot" />}
                      {video.status.toLowerCase()}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* YouTube Analytics */}
        <div className="xl:col-span-1">
          <YouTubeAnalytics />
        </div>
      </div>
    </div>
  );
}
