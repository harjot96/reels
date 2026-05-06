import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { CalendarClock, Clock } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

export default async function SchedulePage() {
  const session = await getServerSession(authOptions);
  const userId = (session!.user as { id: string }).id;

  const scheduled = await prisma.video.findMany({
    where: { series: { userId }, status: "SCHEDULED" },
    include: { series: { select: { title: true } } },
    orderBy: { scheduledFor: "asc" },
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title">Schedule</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {scheduled.length} upcoming publish{scheduled.length !== 1 ? "es" : ""}
        </p>
      </div>

      {scheduled.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 border rounded-xl bg-card/50 text-center">
          <div className="w-16 h-16 rounded-2xl bg-secondary/60 flex items-center justify-center mb-4">
            <CalendarClock className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <p className="font-semibold">No scheduled videos</p>
          <p className="text-sm text-muted-foreground mt-1">
            Set videos to scheduled status to see them here
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {scheduled.map((video) => (
            <Link
              key={video.id}
              href={`/videos/${video.id}`}
              className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-secondary/30 hover:border-border/80 transition-all duration-150 group"
            >
              {/* Calendar icon */}
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                <CalendarClock className="h-4.5 w-4.5 text-purple-400" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                  {video.title}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{video.series.title}</p>
              </div>

              {/* Time */}
              <div className="text-right shrink-0">
                <span className="status-pill status-pill-scheduled">scheduled</span>
                {video.scheduledFor && (
                  <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center justify-end gap-1">
                    <Clock className="h-3 w-3" />
                    {format(new Date(video.scheduledFor), "MMM d, h:mm a")}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
