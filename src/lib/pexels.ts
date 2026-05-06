import { saveFile } from "./storage";

// Pexels orientation per video format
const ORIENTATIONS: Record<string, string> = {
  landscape: "landscape",
  shorts: "portrait",
  square: "landscape", // no square orientation on Pexels; we pad in ffmpeg
};

// Keywords that indicate human/presenter footage is wanted
const HUMAN_KEYWORDS = /expert|doctor|scientist|teacher|person|people|man|woman|presenter|speaker|professional|researcher|demonstrat|explain|show|talk/i;

// Strip cinematic/style words so Pexels gets a plain subject query
function toSearchQuery(visualDescription: string): string {
  const cleaned = visualDescription
    .replace(/cinematic|slow[\s-]motion|close[\s-]up|macro|wide[\s-]angle|aerial|overhead|shot of|footage of|video of|4k|hd/gi, "")
    .replace(/at golden hour|golden hour|blue hour|at sunset|at sunrise|warm.*lighting|ambient.*light/gi, "")
    .split(",")[0]
    .replace(/\s+/g, " ")
    .trim();

  const base = cleaned.split(" ").slice(0, 5).join(" ") || visualDescription.split(" ").slice(0, 3).join(" ");

  // If description already implies people, return as-is
  if (HUMAN_KEYWORDS.test(visualDescription)) return base;

  // Otherwise append "people" to get human-centric footage
  return `${base} people`;
}

interface PexelsVideoFile {
  link: string;
  width: number;
  height: number;
  file_type: string;
}

interface PexelsVideo {
  video_files: PexelsVideoFile[];
}

interface PexelsSearchResult {
  videos: PexelsVideo[];
}

async function searchPexels(query: string, orientation: string): Promise<PexelsVideo[]> {
  const apiKey = process.env.PEXELS_API_KEY!;
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=5&orientation=${orientation}&size=medium`;
  const res = await fetch(url, { headers: { Authorization: apiKey } });
  if (!res.ok) throw new Error(`Pexels search failed: ${res.status} ${res.statusText}`);
  const data = (await res.json()) as PexelsSearchResult;
  return data.videos ?? [];
}

export async function searchAndDownloadClip(
  visualDescription: string,
  videoFormat: string,
  videoId: string,
  index: number
): Promise<string> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey || apiKey.startsWith("replace")) {
    throw new Error("PEXELS_API_KEY not configured — get a free key at pexels.com/api");
  }

  const orientation = ORIENTATIONS[videoFormat] ?? "landscape";
  const query = toSearchQuery(visualDescription);

  // Try full query first, then a 2-word fallback
  let videos = await searchPexels(query, orientation);
  if (!videos.length) {
    const fallback = query.split(" ").slice(0, 2).join(" ");
    videos = await searchPexels(fallback, orientation);
  }
  if (!videos.length) throw new Error(`No video clips found for: "${query}"`);

  // Pick randomly from top 3 results for variety
  const video = videos[Math.floor(Math.random() * Math.min(3, videos.length))];

  // Prefer HD (≤1920px wide), avoid tiny or massive files
  const files = [...(video.video_files ?? [])].sort((a, b) => b.width - a.width);
  const preferred = files.find((f) => f.width <= 1920 && f.width >= 720) ?? files[files.length - 1];
  if (!preferred?.link) throw new Error("No suitable video file found from Pexels");

  const videoRes = await fetch(preferred.link);
  if (!videoRes.ok) throw new Error(`Failed to download Pexels clip: ${videoRes.status}`);

  const buffer = Buffer.from(await videoRes.arrayBuffer());
  return saveFile(buffer, videoId, `clip_${index}.mp4`, "video/mp4");
}
