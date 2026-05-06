import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { CheckCircle2, XCircle, User } from "lucide-react";

const ENV_VARS = [
  { label: "Claude AI (Script)", env: "ANTHROPIC_API_KEY" },
  { label: "ElevenLabs (Voice)", env: "ELEVENLABS_API_KEY" },
  { label: "Replicate (Images)", env: "REPLICATE_API_TOKEN" },
  { label: "YouTube OAuth", env: "YOUTUBE_CLIENT_ID" },
  { label: "Instagram App ID", env: "INSTAGRAM_APP_ID" },
  { label: "Instagram App Secret", env: "INSTAGRAM_APP_SECRET" },
  { label: "Facebook App ID", env: "FACEBOOK_APP_ID" },
  { label: "Facebook App Secret", env: "FACEBOOK_APP_SECRET" },
  { label: "Public Base URL", env: "PUBLIC_BASE_URL" },
];

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="text-muted-foreground mt-1 text-sm">Manage your account and integrations</p>
      </div>

      {/* Account card */}
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-sm font-semibold mb-4">Account</p>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-primary">
              {session?.user?.name?.[0]?.toUpperCase() ?? "?"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{session?.user?.name}</p>
            <p className="text-xs text-muted-foreground">{session?.user?.email}</p>
          </div>
          <span className="status-pill status-pill-ready">Free Plan</span>
        </div>
      </div>

      {/* Environment card */}
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-sm font-semibold mb-4">Environment Variables</p>
        <div className="space-y-0">
          {ENV_VARS.map(({ label, env }, i) => {
            const isSet = !!(process.env[env] && !process.env[env]?.includes("replace"));
            return (
              <div
                key={env}
                className={`flex items-center justify-between py-2.5 ${i < ENV_VARS.length - 1 ? "border-b border-border/60" : ""}`}
              >
                <span className="text-sm">{label}</span>
                <div className="flex items-center gap-1.5">
                  {isSet
                    ? <><CheckCircle2 className="h-3.5 w-3.5 text-green-400" /><span className="text-xs text-green-400 font-medium">Configured</span></>
                    : <><XCircle className="h-3.5 w-3.5 text-destructive" /><span className="text-xs text-destructive font-medium">Not set</span></>
                  }
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
