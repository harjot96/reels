import { Sparkles } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-background overflow-hidden">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[45%] flex-col justify-between p-10 relative overflow-hidden">
        {/* Mesh background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-[600px] h-[600px] rounded-full opacity-20"
            style={{ background: "radial-gradient(circle, hsl(262 83% 68% / 60%) 0%, transparent 70%)", transform: "translate(-30%, -30%)" }} />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full opacity-15"
            style={{ background: "radial-gradient(circle, hsl(280 70% 60% / 60%) 0%, transparent 70%)", transform: "translate(30%, 30%)" }} />
          <div className="absolute top-1/2 left-1/2 w-[300px] h-[300px] rounded-full opacity-10"
            style={{ background: "radial-gradient(circle, hsl(240 80% 70% / 50%) 0%, transparent 70%)", transform: "translate(-50%, -50%)" }} />
        </div>

        {/* Grid overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.035]"
          style={{ backgroundImage: "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg"
            style={{ background: "linear-gradient(135deg, hsl(262 83% 68%), hsl(280 70% 55%))" }}>
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">Faceless AI</span>
        </div>

        {/* Hero text */}
        <div className="relative space-y-6">
          <div className="space-y-3">
            <h1 className="text-4xl font-bold leading-tight">
              Your AI-powered<br />
              <span className="gradient-text">video studio</span>
            </h1>
            <p className="text-muted-foreground text-base leading-relaxed max-w-sm">
              Generate, schedule, and auto-publish faceless video series to YouTube, Instagram, Facebook and more — on autopilot.
            </p>
          </div>
          <div className="flex flex-col gap-3 text-sm">
            {[
              { icon: "✦", text: "AI scripts + voiceover + visuals in minutes" },
              { icon: "✦", text: "Auto-publish to 4+ platforms simultaneously" },
              { icon: "✦", text: "Livestream your best videos on loop" },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-3 text-muted-foreground">
                <span className="text-primary text-xs shrink-0">{item.icon}</span>
                {item.text}
              </div>
            ))}
          </div>
        </div>

        {/* Footer quote */}
        <div className="relative">
          <p className="text-xs text-muted-foreground/60">
            "The best time to start your YouTube channel was yesterday. The second best time is now."
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2.5 mb-10">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, hsl(262 83% 68%), hsl(280 70% 55%))" }}>
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-base">Faceless AI</span>
        </div>

        <div className="w-full max-w-sm animate-fade-in-scale">
          {children}
        </div>
      </div>
    </div>
  );
}
