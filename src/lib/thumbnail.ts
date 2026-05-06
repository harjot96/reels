import ffmpeg from "fluent-ffmpeg";
import * as fs from "fs";
import * as path from "path";
import { saveFile, getAbsolutePath } from "./storage";

const ffmpegPath = process.env.FFMPEG_PATH || "/usr/local/bin/ffmpeg";
ffmpeg.setFfmpegPath(ffmpegPath);

// Escape special chars for FFmpeg drawtext
function esc(t: string): string {
  return t
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\u2019")   // smart quote — safe in drawtext
    .replace(/:/g, "\\:")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/,/g, "\\,");
}

// Split title into max 2 lines of ~30 chars each
function splitTitle(title: string): [string, string] {
  const MAX = 30;
  if (title.length <= MAX) return [title, ""];
  const cut = title.lastIndexOf(" ", MAX);
  const idx = cut > 8 ? cut : MAX;
  return [title.slice(0, idx).trim(), title.slice(idx).trim().slice(0, MAX)];
}

/**
 * Extracts a frame from the assembled video, adds a dark gradient + bold title text,
 * saves as thumbnail.jpg and returns the API path.
 */
export async function generateThumbnail(
  videoId: string,
  videoApiPath: string,
  title: string
): Promise<string> {
  const videoAbs = getAbsolutePath(videoApiPath);
  const tmpDir = path.resolve(process.env.LOCAL_STORAGE_PATH || "./storage", videoId);
  const thumbPath = path.join(tmpDir, "thumbnail.jpg");

  const [line1, line2] = splitTitle(title);

  // Build filter chain
  const filters = [
    // Scale + crop to 1280×720
    "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720",
    // Slight contrast + saturation boost to make it pop
    "eq=contrast=1.15:saturation=1.3:brightness=0.05",
    // Dark gradient at bottom 45%
    "drawbox=x=0:y=ih*0.55:w=iw:h=ih*0.45:color=black@0.75:t=fill",
    // Line 1 — big white bold text
    `drawtext=text='${esc(line1)}':fontsize=68:fontcolor=white:borderw=4:bordercolor=black@0.9:x=(w-text_w)/2:y=${line2 ? "h*0.62" : "h*0.70"}`,
    // Line 2 — only rendered if title wraps
    ...(line2
      ? [`drawtext=text='${esc(line2)}':fontsize=68:fontcolor=white:borderw=4:bordercolor=black@0.9:x=(w-text_w)/2:y=h*0.78`]
      : []),
  ].join(",");

  await new Promise<void>((resolve, reject) => {
    ffmpeg(videoAbs)
      .seekInput(3)           // grab frame at 3s (skip black intro)
      .frames(1)
      .outputOptions([`-vf ${filters}`, "-q:v 2"])
      .output(thumbPath)
      .on("end", () => resolve())
      .on("error", (err) => reject(new Error(`Thumbnail generation failed: ${err.message}`)))
      .run();
  });

  const buffer = await fs.promises.readFile(thumbPath);
  return saveFile(buffer, videoId, "thumbnail.jpg", "image/jpeg");
}
