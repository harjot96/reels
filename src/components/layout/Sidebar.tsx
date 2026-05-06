"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard, Film, Video, CalendarClock, Settings,
  LogOut, Sparkles, PlayCircle, Camera, ThumbsUp, GitBranch,
  Radio, Ghost, ChevronRight, Music2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";

const navGroups = [
  {
    label: "Studio",
    items: [
      { href: "/dashboard",  label: "Dashboard",  icon: LayoutDashboard },
      { href: "/series",     label: "Series",     icon: Film },
      { href: "/videos",     label: "Videos",     icon: Video },
      { href: "/schedule",   label: "Schedule",   icon: CalendarClock },
      { href: "/workflows",  label: "Workflows",  icon: GitBranch },
      { href: "/live",       label: "Go Live",    icon: Radio },
      { href: "/music",      label: "Trending Audio", icon: Music2 },
    ],
  },
  {
    label: "Publish to",
    items: [
      { href: "/settings/youtube",   label: "YouTube",   icon: PlayCircle },
      { href: "/settings/instagram", label: "Instagram", icon: Camera },
      { href: "/settings/facebook",  label: "Facebook",  icon: ThumbsUp },
      { href: "/settings/snapchat",  label: "Snapchat",  icon: Ghost },
    ],
  },
];

interface SidebarProps {
  user?: { name?: string | null; email?: string | null };
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();

  function isActive(href: string) {
    return pathname === href || (href !== "/settings" && href !== "/dashboard" && pathname.startsWith(href));
  }

  return (
    <aside className="w-56 flex flex-col border-r border-border/60 bg-card/50 h-full shrink-0 relative">
      {/* Subtle top glow */}
      <div className="absolute top-0 left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, hsl(var(--primary) / 40%), transparent)" }} />

      {/* Logo */}
      <div className="p-4 border-b border-border/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-md shrink-0"
            style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(280 70% 55%))" }}>
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="font-bold text-sm leading-none tracking-tight">Faceless AI</p>
            <p className="text-[10px] text-muted-foreground/70 mt-0.5 tracking-wide">Video Studio</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-5 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-[0.15em] px-3 mb-1.5">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn("sidebar-link", isActive(href) && "active")}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-[13px]">{label}</span>
                  {isActive(href) && <ChevronRight className="h-3 w-3 opacity-50" />}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User area */}
      <div className="p-3 border-t border-border/60 space-y-0.5">
        <div className="flex items-center gap-2.5 px-3 py-2 mb-1 justify-between">
          <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold"
            style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 25%), hsl(280 70% 55% / 20%))", color: "hsl(var(--primary))", border: "1px solid hsl(var(--primary) / 20%)" }}>
            {user?.name?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-medium truncate leading-none">{user?.name}</p>
            <p className="text-[10px] text-muted-foreground/60 truncate mt-0.5">{user?.email}</p>
          </div>
          <ThemeToggle />
        </div>
        <Link href="/settings"
          className={cn("sidebar-link text-[13px]", isActive("/settings") && "active")}>
          <Settings className="h-3.5 w-3.5" /> Settings
        </Link>
        <button
          className="sidebar-link w-full text-[13px] text-muted-foreground hover:text-rose-400 hover:bg-rose-500/8 transition-colors"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="h-3.5 w-3.5" /> Sign out
        </button>
      </div>
    </aside>
  );
}
