import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

const PIXABAY_KEY = process.env.PIXABAY_API_KEY;

const CATEGORY_QUERY_MAP: Record<string, string> = {
  trending:     "popular music",
  beats:        "beats hip hop",
  ambient:      "ambient relaxing",
  cinematic:    "cinematic epic",
  electronic:   "electronic synth",
  acoustic:     "acoustic guitar folk",
  jazz:         "jazz piano",
  pop:          "pop upbeat",
  dark:         "dark dramatic suspense",
  motivational: "motivational inspiring",
};

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!PIXABAY_KEY || PIXABAY_KEY.startsWith("replace")) {
    // Return demo tracks when key not configured
    return NextResponse.json({ tracks: DEMO_TRACKS, demo: true });
  }

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") ?? "trending";
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const query = CATEGORY_QUERY_MAP[category] ?? CATEGORY_QUERY_MAP.trending;

  try {
    const url = new URL("https://pixabay.com/api/videos/music/");
    url.searchParams.set("key", PIXABAY_KEY);
    url.searchParams.set("q", query);
    url.searchParams.set("per_page", "20");
    url.searchParams.set("page", String(page));
    url.searchParams.set("order", "popular");

    const res = await fetch(url.toString(), { next: { revalidate: 300 } });
    if (!res.ok) throw new Error(`Pixabay ${res.status}`);

    const data = await res.json() as {
      totalHits: number;
      hits: Array<{
        id: number;
        title: string;
        audio: string;
        duration: number;
        tags: string;
        user: string;
        userImageURL: string;
        likes: number;
        downloads: number;
        views: number;
      }>;
    };

    const tracks = (data.hits ?? []).map((h) => ({
      id:        String(h.id),
      title:     h.title || "Untitled Track",
      artist:    h.user || "Pixabay Artist",
      audioUrl:  h.audio,
      duration:  h.duration,
      tags:      h.tags?.split(",").map((t: string) => t.trim()).filter(Boolean).slice(0, 4) ?? [],
      likes:     h.likes,
      downloads: h.downloads,
      avatarUrl: h.userImageURL || null,
    }));

    return NextResponse.json({ tracks, total: data.totalHits, page, demo: false });
  } catch (e) {
    console.error("Trending audio error:", e);
    return NextResponse.json({ tracks: DEMO_TRACKS, demo: true });
  }
}

// Fallback demo tracks when Pixabay key not set
const DEMO_TRACKS = [
  { id: "demo1", title: "Uplifting Journey", artist: "AudioCraft", audioUrl: "", duration: 180, tags: ["uplifting", "cinematic"], likes: 1240, downloads: 5400, avatarUrl: null },
  { id: "demo2", title: "Midnight Drive", artist: "SoundWave", audioUrl: "", duration: 210, tags: ["electronic", "beats"], likes: 987, downloads: 3200, avatarUrl: null },
  { id: "demo3", title: "Peaceful Piano", artist: "MeloSoft", audioUrl: "", duration: 240, tags: ["piano", "ambient"], likes: 2100, downloads: 8900, avatarUrl: null },
  { id: "demo4", title: "Epic Trailer", artist: "StudioFX", audioUrl: "", duration: 195, tags: ["cinematic", "epic"], likes: 3400, downloads: 12000, avatarUrl: null },
  { id: "demo5", title: "Lo-Fi Chill", artist: "ChillBeats", audioUrl: "", duration: 165, tags: ["lo-fi", "chill"], likes: 5600, downloads: 21000, avatarUrl: null },
  { id: "demo6", title: "Tech Pulse", artist: "NeonSync", audioUrl: "", duration: 200, tags: ["electronic", "tech"], likes: 890, downloads: 2900, avatarUrl: null },
];
