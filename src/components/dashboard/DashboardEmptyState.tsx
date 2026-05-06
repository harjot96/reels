"use client";
import { Plus, Sparkles, Upload } from "lucide-react";
import Link from "next/link";
import UploadVideoModal from "@/components/dashboard/UploadVideoModal";

export default function DashboardEmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-border/60 bg-card/30 p-10 text-center flex flex-col items-center gap-5">
      <div className="relative">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, hsl(var(--primary)/20%), hsl(280 70% 55%/15%))", border: "1px solid hsl(var(--primary)/20%)" }}>
          <Sparkles className="h-7 w-7 text-primary" />
        </div>
        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary animate-pulse opacity-60" />
      </div>

      <div className="space-y-1.5">
        <p className="font-semibold text-base">No videos yet</p>
        <p className="text-muted-foreground text-sm max-w-xs mx-auto leading-relaxed">
          Create a series to start generating faceless AI videos automatically.
        </p>
      </div>

      <div className="flex flex-wrap gap-2.5 justify-center">
        <Link href="/series/new" className="btn-primary gap-2">
          <Plus className="h-4 w-4" />
          Create Series
        </Link>
        <UploadVideoModal />
      </div>
    </div>
  );
}
