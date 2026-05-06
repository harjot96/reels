import * as path from "path";
import { saveFile } from "./storage";

const PIXABAY_KEY = process.env.PIXABAY_API_KEY;

// Map niche keywords to background music moods
function pickMood(niche: string): string {
  const n = niche.toLowerCase();
  if (/horror|ghost|scary|dark|mystery|crime/.test(n)) return "dark ambient";
  if (/motivat|success|business|finance|money/.test(n)) return "inspiring upbeat";
  if (/meditat|yoga|health|wellness|calm/.test(n)) return "relaxing meditation";
  if (/technolog|science|future|ai/.test(n)) return "electronic technology";
  if (/history|documentary|fact/.test(n)) return "cinematic documentary";
  return "background instrumental";
}

interface PixabayMusicHit {
  id: number;
  audio: string;
  duration: number;
  title: string;
}

/**
 * Fetch a royalty-free background music track from Pixabay.
 * Returns the local saved path, or null if PIXABAY_API_KEY is not set.
 */
export async function fetchBackgroundMusic(
  niche: string,
  videoId: string
): Promise<string | null> {
  if (!PIXABAY_KEY || PIXABAY_KEY.startsWith("replace")) return null;

  const mood = pickMood(niche);
  const url = `https://pixabay.com/api/videos/music/?key=${PIXABAY_KEY}&q=${encodeURIComponent(mood)}&per_page=10`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Pixabay music API error: ${res.status}`);
    const data = await res.json() as { hits: PixabayMusicHit[] };

    if (!data.hits?.length) return null;

    // Pick a random track from top 5
    const track = data.hits[Math.floor(Math.random() * Math.min(5, data.hits.length))];

    const audioRes = await fetch(track.audio);
    if (!audioRes.ok) return null;

    const buffer = Buffer.from(await audioRes.arrayBuffer());
    return saveFile(buffer, videoId, "bgmusic.mp3", "audio/mpeg");
  } catch {
    return null;  // Music is optional — never fail the pipeline over it
  }
}
