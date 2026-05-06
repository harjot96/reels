import ffmpeg from "fluent-ffmpeg";
import * as fs from "fs";
import * as path from "path";
import { execFile } from "child_process";
import { getAbsolutePath, saveFile } from "./storage";
import type { ScriptSegment } from "./claude";

const ffmpegPath = process.env.FFMPEG_PATH || "/usr/local/bin/ffmpeg";
const ffprobePath = process.env.FFPROBE_PATH || "/usr/local/bin/ffprobe";
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const VIDEO_RESOLUTIONS: Record<string, { w: number; h: number }> = {
  landscape: { w: 1920, h: 1080 },
  shorts:    { w: 1080, h: 1920 },
  square:    { w: 1080, h: 1080 },
};

let drawtextAvailableCache: boolean | undefined;

async function hasDrawtextFilter(): Promise<boolean> {
  if (drawtextAvailableCache !== undefined) return drawtextAvailableCache;

  drawtextAvailableCache = await new Promise<boolean>((resolve) => {
    execFile(ffmpegPath, ["-hide_banner", "-filters"], { maxBuffer: 2 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        // Keep prior behavior if probing fails.
        resolve(true);
        return;
      }
      const out = `${stdout ?? ""}\n${stderr ?? ""}`;
      resolve(/\bdrawtext\b/i.test(out));
    });
  });

  return drawtextAvailableCache;
}

function timemarkToSeconds(timemark?: string): number {
  if (!timemark) return 0;
  // Example: "00:01:23.45"
  const m = timemark.match(/^(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/);
  if (!m) return 0;
  const h = Number(m[1] ?? 0);
  const min = Number(m[2] ?? 0);
  const sec = Number(m[3] ?? 0);
  const frac = Number(`0.${m[4] ?? "0"}`);
  return h * 3600 + min * 60 + sec + frac;
}

function escDrawtext(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
    .replace(/'/g, "\\'")
    .replace(/%/g, "\\%")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toOverlayTitle(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const firstWords = clean.split(" ").slice(0, 10).join(" ");
  return firstWords.length > 64 ? `${firstWords.slice(0, 61).trim()}...` : firstWords;
}

// Trim/loop a clip to exactly `duration` seconds and scale/pad to target resolution.
// Uses -stream_loop so short AI clips (5-6s) can fill longer segments.
// Output has no audio (-an) — audio is mixed in during final assembly.
async function processClip(
  inputPath: string,
  outputPath: string,
  duration: number,
  w: number,
  h: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .inputOptions(["-stream_loop -1"])   // loop input indefinitely — setDuration cuts it
      .setDuration(duration)
      .outputOptions([
        `-vf scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1`,
        "-r 30",
        "-c:v libx264",
        "-preset ultrafast",
        "-crf 23",
        "-threads 0",
        "-an",
        "-pix_fmt yuv420p",
      ])
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (err) => reject(new Error(`processClip failed: ${err.message}`)))
      .run();
  });
}

// Assemble real video clips (from Pexels) + voiceover audio into final MP4
export async function assembleVideoFromClips(
  videoId: string,
  clipApiPaths: string[],
  audioApiPath: string,
  durationSeconds: number,
  videoFormat: string = "landscape",
  onProgress?: (percent: number) => void
): Promise<string> {
  const { w, h } = VIDEO_RESOLUTIONS[videoFormat] ?? VIDEO_RESOLUTIONS.landscape;
  const segmentDuration = durationSeconds / clipApiPaths.length;
  const tmpDir = path.resolve(process.env.LOCAL_STORAGE_PATH || "./storage", videoId);
  const outputPath = path.join(tmpDir, "video.mp4");
  const audioAbsPath = getAbsolutePath(audioApiPath);

  // Step 1: Trim + scale each clip to segment duration
  const processedPaths: string[] = [];
  for (let i = 0; i < clipApiPaths.length; i++) {
    const inputAbs = getAbsolutePath(clipApiPaths[i]);
    const procPath = path.join(tmpDir, `clip_${i}_proc.mp4`);
    await processClip(inputAbs, procPath, segmentDuration, w, h);
    processedPaths.push(procPath);
    // Processing clip prep = first 40% of conversion progress.
    onProgress?.(Math.min(40, Math.round(((i + 1) / clipApiPaths.length) * 40)));
  }

  // Step 2: Build concat list
  const concatListPath = path.join(tmpDir, "clip_concat.txt");
  await fs.promises.writeFile(
    concatListPath,
    processedPaths.map((p) => `file '${p}'`).join("\n")
  );

  // Step 3: Concat clips + mix voiceover
  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(concatListPath)
      .inputOptions(["-f concat", "-safe 0"])
      .input(audioAbsPath)
      .outputOptions([
        "-map 0:v:0",
        "-map 1:a:0",
        "-c:v libx264",
        "-preset fast",
        "-crf 23",
        "-threads 0",
        "-c:a aac",
        "-b:a 128k",
        "-shortest",
        "-pix_fmt yuv420p",
        "-movflags +faststart",
      ])
      .output(outputPath)
      .on("progress", (p) => {
        const sec = timemarkToSeconds(p.timemark);
        const concatPct = durationSeconds > 0
          ? Math.max(0, Math.min(100, Math.round((sec / durationSeconds) * 100)))
          : 0;
        onProgress?.(Math.min(99, 40 + Math.round((concatPct / 100) * 60)));
      })
      .on("end", () => resolve())
      .on("error", (err) => reject(new Error(`assembleVideoFromClips failed: ${err.message}`)))
      .run();
  });

  onProgress?.(100);

  const buffer = await fs.promises.readFile(outputPath);
  return saveFile(buffer, videoId, "video.mp4", "video/mp4");
}

// Legacy: assemble from static AI-generated images (fallback when no Pexels key)
export async function assembleVideo(
  videoId: string,
  imageApiPaths: string[],
  audioApiPath: string,
  durationSeconds: number,
  videoFormat: string = "landscape",
  onProgress?: (percent: number) => void
): Promise<string> {
  const { w, h } = VIDEO_RESOLUTIONS[videoFormat] ?? VIDEO_RESOLUTIONS.landscape;
  const timePerImage = durationSeconds / imageApiPaths.length;
  const audioAbsPath = getAbsolutePath(audioApiPath);
  const tmpDir = path.resolve(process.env.LOCAL_STORAGE_PATH || "./storage", videoId);
  const outputPath = path.join(tmpDir, "video.mp4");
  const concatListPath = path.join(tmpDir, "concat.txt");

  const concatLines = imageApiPaths
    .map((p) => `file '${getAbsolutePath(p)}'\nduration ${timePerImage}`)
    .join("\n");
  const fullConcat = concatLines + `\nfile '${getAbsolutePath(imageApiPaths[imageApiPaths.length - 1])}'`;
  await fs.promises.writeFile(concatListPath, fullConcat);

  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(concatListPath)
      .inputOptions(["-f concat", "-safe 0"])
      .input(audioAbsPath)
      .outputOptions([
        "-c:v libx264",
        "-preset fast",
        "-crf 23",
        "-threads 0",
        `-vf scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1`,
        "-c:a aac",
        "-b:a 128k",
        "-shortest",
        "-pix_fmt yuv420p",
        "-movflags +faststart",
      ])
      .output(outputPath)
      .on("progress", (p) => {
        const sec = timemarkToSeconds(p.timemark);
        const pct = durationSeconds > 0
          ? Math.max(0, Math.min(100, Math.round((sec / durationSeconds) * 100)))
          : 0;
        onProgress?.(Math.min(99, pct));
      })
      .on("end", () => resolve())
      .on("error", (err) => reject(new Error(`assembleVideo failed: ${err.message}`)))
      .run();
  });

  onProgress?.(100);

  const buffer = await fs.promises.readFile(outputPath);
  return saveFile(buffer, videoId, "video.mp4", "video/mp4");
}

// Concatenate multiple MP3 chunks into a single audio file (for long voiceovers)
export async function concatAudioChunks(videoId: string, chunkPaths: string[]): Promise<string> {
  const tmpDir = path.resolve(process.env.LOCAL_STORAGE_PATH || "./storage", videoId);
  const concatList = path.join(tmpDir, "audio_concat.txt");
  const outputPath = path.join(tmpDir, "audio.mp3");

  await fs.promises.writeFile(concatList, chunkPaths.map((p) => `file '${p}'`).join("\n"));

  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(concatList)
      .inputOptions(["-f concat", "-safe 0"])
      .outputOptions(["-c copy"])
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (err) => reject(new Error(`concatAudioChunks failed: ${err.message}`)))
      .run();
  });

  const buffer = await fs.promises.readFile(outputPath);
  return saveFile(buffer, videoId, "audio.mp3", "audio/mpeg");
}

export type VideoMeta = { isLandscape: boolean; hasAudio: boolean };

export async function probeVideo(videoApiPath: string): Promise<VideoMeta> {
  const inputAbs = getAbsolutePath(videoApiPath);
  try {
    return await new Promise<VideoMeta>((res, rej) => {
      ffmpeg.ffprobe(inputAbs, (err, data) => {
        if (err) { rej(err); return; }
        const vs = data.streams?.find((s) => s.codec_type === "video");
        const as = data.streams?.find((s) => s.codec_type === "audio");
        const w = vs?.width ?? 0;
        const h = vs?.height ?? 0;
        res({ isLandscape: w > 0 && h > 0 ? w > h : true, hasAudio: !!as });
      });
    });
  } catch {
    return { isLandscape: true, hasAudio: true };
  }
}

export async function findExternalAudio(videoId: string): Promise<string | null> {
  const tmpDir = path.resolve(process.env.LOCAL_STORAGE_PATH || "./storage", videoId);
  for (const ext of ["mp3", "wav", "ogg", "flac", "m4a", "aac"]) {
    const candidate = path.join(tmpDir, `audio.${ext}`);
    try {
      await fs.promises.access(candidate, fs.constants.R_OK);
      return candidate;
    } catch { /* not found */ }
  }
  return null;
}

export { hasDrawtextFilter };

export type CutShortMeta = VideoMeta & { externalAudioAbs: string | null; drawtextAvailable: boolean };

/**
 * Cut a short clip (vertical 9:16) from a long video.
 * If the source is landscape (16:9) it center-crops to vertical.
 * Used for YouTube Shorts generation.
 * Pass `cachedMeta` to skip repeated ffprobe/filesystem calls when cutting multiple shorts.
 */
export async function cutShort(
  videoId: string,
  videoApiPath: string,
  startTime: number,
  duration: number,
  index: number,
  sourceFormat: string = "landscape",
  title?: string,
  captionText?: string,
  cachedMeta?: CutShortMeta
): Promise<string> {
  const inputAbs = getAbsolutePath(videoApiPath);
  const { w: dstW, h: dstH } = VIDEO_RESOLUTIONS.shorts; // 1080×1920
  const tmpDir = path.resolve(process.env.LOCAL_STORAGE_PATH || "./storage", videoId);
  await fs.promises.mkdir(tmpDir, { recursive: true });
  const outputPath = path.join(tmpDir, `short_${index}.mp4`);

  // Probe actual dimensions and audio presence — skip if caller already probed
  let isActuallyLandscape = cachedMeta?.isLandscape ?? (sourceFormat === "landscape");
  let sourceHasAudio = cachedMeta?.hasAudio ?? true;
  if (!cachedMeta) {
    try {
      const meta = await new Promise<{ width?: number; height?: number; hasAudio: boolean }>((res, rej) => {
        ffmpeg.ffprobe(inputAbs, (err, data) => {
          if (err) rej(err);
          else {
            const vs = data.streams?.find((s) => s.codec_type === "video");
            const as = data.streams?.find((s) => s.codec_type === "audio");
            res({ width: vs?.width, height: vs?.height, hasAudio: !!as });
          }
        });
      });
      if (meta.width && meta.height) {
        isActuallyLandscape = meta.width > meta.height;
      }
      sourceHasAudio = meta.hasAudio;
    } catch { /* use sourceFormat fallback */ }
  }

  // Crop landscape → vertical by taking center strip; otherwise scale+pad
  const cropFilter = isActuallyLandscape
    ? `crop=ih*9/16:ih:(iw-ih*9/16)/2:0,scale=${dstW}:${dstH}`
    : `scale=${dstW}:${dstH}:force_original_aspect_ratio=decrease,pad=${dstW}:${dstH}:(ow-iw)/2:(oh-ih)/2:color=black`;

  // Semi-transparent strips: top = title zone, bottom = caption/CTA zone.
  // Strip non-ASCII to avoid drawtext font issues; fall back to "Part N".
  function toSafeText(text: string, fallback: string): string {
    const asciiOnly = text.replace(/[^\x00-\x7F]/g, "").replace(/\s+/g, " ").trim();
    return escDrawtext((asciiOnly || fallback).slice(0, 60));
  }

  const partFallback = title?.match(/Part\s+\d+/i)?.[0] ?? `Part ${index + 1}`;
  const safeTitle = title ? toSafeText(title, partFallback) : escDrawtext(partFallback);
  const safeCaption = captionText ? toSafeText(captionText, "") : "";

  const overlayFilters: string[] = [
    `drawbox=x=0:y=0:w=w:h=h*0.12:color=black@0.5:t=fill`,
    `drawtext=text='${safeTitle}':fontcolor=white:fontsize=h*0.042:borderw=2:bordercolor=black@0.8:x=(w-text_w)/2:y=h*0.04`,
    `drawbox=x=0:y=h*0.82:w=w:h=h*0.18:color=black@0.4:t=fill`,
    ...(safeCaption
      ? [`drawtext=text='${safeCaption}':fontcolor=white:fontsize=h*0.038:borderw=2:bordercolor=black@0.8:x=(w-text_w)/2:y=h*0.855`]
      : []),
  ];

  const drawtextAvailable = cachedMeta?.drawtextAvailable ?? await hasDrawtextFilter();
  const vfChain = drawtextAvailable
    ? `${cropFilter},setsar=1,${overlayFilters.join(",")}`
    : `${cropFilter},setsar=1`;

  // If the video was produced from an audio file (MP3→video), the muxed AAC stream
  // can be corrupt on some FFmpeg builds. Use the original audio file if it exists.
  let externalAudioAbs: string | null = cachedMeta !== undefined ? cachedMeta.externalAudioAbs : null;
  if (!cachedMeta) {
    for (const ext of ["mp3", "wav", "ogg", "flac", "m4a", "aac"]) {
      const candidate = path.join(tmpDir, `audio.${ext}`);
      try {
        await fs.promises.access(candidate, fs.constants.R_OK);
        externalAudioAbs = candidate;
        break;
      } catch { /* not found */ }
    }
  }

  async function runCut(vf: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const cmd = ffmpeg();

      // Video input with seek
      cmd.input(inputAbs).inputOptions([`-ss ${startTime}`, `-t ${duration}`]);

      // If external audio exists, use it to avoid corrupted muxed AAC
      if (externalAudioAbs) {
        cmd.input(externalAudioAbs).inputOptions([`-ss ${startTime}`, `-t ${duration}`]);
      }

      const hasAudioOutput = externalAudioAbs || sourceHasAudio;
      const audioOpts = hasAudioOutput
        ? [
            externalAudioAbs ? "-map 1:a:0" : "-map 0:a:0",
            "-c:a aac",
            "-b:a 128k",
          ]
        : ["-an"]; // no audio stream — silence the output cleanly

      cmd
        .outputOptions([
          "-map 0:v:0",
          ...audioOpts,
          "-vf", vf,
          `-t ${duration}`,
          "-r 30",
          "-c:v libx264",
          "-preset ultrafast",
          "-crf 23",
          "-threads 0",
          "-pix_fmt yuv420p",
          "-movflags +faststart",
        ])
        .output(outputPath)
        .on("end", () => resolve())
        .on("error", async (err) => {
          // FFmpeg 8.x exits with code 69 even on success when AAC encoder
          // signals stream-end via -t. Treat as success if output file has content.
          try {
            const stat = await fs.promises.stat(outputPath);
            if (stat.size > 1024) { resolve(); return; }
          } catch { /* file missing — real error */ }
          reject(err);
        })
        .run();
    });
  }

  try {
    await runCut(vfChain);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const shouldRetryWithoutText =
      /drawtext/i.test(msg) || /filter not found/i.test(msg) || /no such filter/i.test(msg);
    if (!shouldRetryWithoutText) {
      throw new Error(`cutShort failed: ${msg}`);
    }

    // Fallback for ffmpeg builds missing drawtext: render the short without text overlays.
    const basicVf = `${cropFilter},setsar=1`;
    try {
      await runCut(basicVf);
    } catch (fallbackErr) {
      const fallbackMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
      throw new Error(`cutShort failed: ${fallbackMsg}`);
    }
  }

  // FFmpeg already wrote to the storage folder; avoid re-reading and re-writing the same file.
  return `/api/files/${videoId}/short_${index}.mp4`;
}

/**
 * Burn short segment titles directly onto the video (on-screen overlay text).
 * This makes the final render feel more like "content with titles" rather than plain b-roll.
 */
export async function overlaySegmentTitles(
  videoId: string,
  videoApiPath: string,
  segments: ScriptSegment[],
  totalDuration: number,
  overlayTitle?: string
): Promise<string> {
  if (!segments.length || totalDuration <= 0) return videoApiPath;
  if (!(await hasDrawtextFilter())) return videoApiPath;

  const inputAbs = getAbsolutePath(videoApiPath);
  const dir = path.resolve(process.env.LOCAL_STORAGE_PATH || "./storage", videoId);
  await fs.promises.mkdir(dir, { recursive: true });
  const outputFilename = "video_titled.mp4";
  const outputAbs = path.join(dir, outputFilename);

  const perSeg = totalDuration / segments.length;
  const filters: string[] = [];

  const forced = toOverlayTitle(overlayTitle ?? "");

  if (forced) {
    const title = escDrawtext(forced);
    filters.push(
      `drawbox=x=0:y=h*0.79:w=w:h=h*0.21:color=black@0.35:t=fill:enable='between(t,0,${totalDuration.toFixed(3)})'`
    );
    filters.push(
      `drawtext=text='${title}':fontcolor=white:fontsize=h*0.045:borderw=2:bordercolor=black@0.8:x=(w-text_w)/2:y=h*0.84:enable='between(t,0,${totalDuration.toFixed(3)})'`
    );
  } else {
    for (let i = 0; i < segments.length; i++) {
      const start = i * perSeg;
      const end = Math.min((i + 1) * perSeg - 0.08, totalDuration);
      if (end <= start) continue;

      const title = escDrawtext(toOverlayTitle(segments[i].text));
      if (!title) continue;

      // Semi-transparent strip + centered title near the bottom.
      filters.push(
        `drawbox=x=0:y=h*0.79:w=w:h=h*0.21:color=black@0.35:t=fill:enable='between(t,${start.toFixed(3)},${end.toFixed(3)})'`
      );
      filters.push(
        `drawtext=text='${title}':fontcolor=white:fontsize=h*0.045:borderw=2:bordercolor=black@0.8:x=(w-text_w)/2:y=h*0.84:enable='between(t,${start.toFixed(3)},${end.toFixed(3)})'`
      );
    }
  }

  if (!filters.length) return videoApiPath;

  const vf = filters.join(",");

  try {
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputAbs)
        .outputOptions([
          `-vf ${vf}`,
          "-c:v libx264",
          "-preset veryfast",
          "-crf 23",
          "-threads 0",
          "-c:a copy",
          "-movflags +faststart",
        ])
        .output(outputAbs)
        .on("end", () => resolve())
        .on("error", (err) => reject(err))
        .run();
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const drawtextMissing = /drawtext/i.test(msg) || /filter not found/i.test(msg) || /no such filter/i.test(msg);
    if (drawtextMissing) return videoApiPath;
    throw new Error(`overlaySegmentTitles failed: ${msg}`);
  }

  return `/api/files/${videoId}/${outputFilename}`;
}

/**
 * Mix quiet background music under an existing video's audio track.
 * musicVolume: 0.0–1.0 (default 0.12 — barely audible under voiceover)
 */
export async function mixBackgroundMusic(
  videoId: string,
  videoApiPath: string,
  musicApiPath: string,
  musicVolume: number = 0.12
): Promise<string> {
  const videoAbs = getAbsolutePath(videoApiPath);
  const musicAbs = getAbsolutePath(musicApiPath);
  const tmpDir = path.resolve(process.env.LOCAL_STORAGE_PATH || "./storage", videoId);
  const outputPath = path.join(tmpDir, "video_music.mp4");

  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(videoAbs)
      .input(musicAbs)
      .inputOptions(["-stream_loop -1"])  // loop music if shorter than video
      .complexFilter([
        // Reduce music volume, then mix with original voiceover
        `[1:a]volume=${musicVolume}[music]`,
        `[0:a][music]amix=inputs=2:duration=first:dropout_transition=3[aout]`,
      ])
      .outputOptions([
        "-map 0:v:0",
        "-map [aout]",
        "-c:v copy",
        "-c:a aac",
        "-b:a 128k",
        "-threads 0",
        "-shortest",
        "-movflags +faststart",
      ])
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (err) => reject(new Error(`mixBackgroundMusic failed: ${err.message}`)))
      .run();
  });

  const buffer = await fs.promises.readFile(outputPath);
  return saveFile(buffer, videoId, "video.mp4", "video/mp4");
}

/**
 * Write a minimal 1x1 black PNG to disk.
 * FFmpeg will scale it to the target resolution via the filter chain.
 */
async function createBlackPng(outputPath: string): Promise<void> {
  // Hand-crafted 1x1 black PNG (67 bytes) — no external deps needed
  const BLACK_PNG = Buffer.from([
    0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a, // signature
    0x00,0x00,0x00,0x0d,0x49,0x48,0x44,0x52, // IHDR chunk
    0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x01, // 1x1
    0x08,0x02,0x00,0x00,0x00,0x90,0x77,0x53, // 8-bit RGB
    0xde,0x00,0x00,0x00,0x0c,0x49,0x44,0x41, // IDAT
    0x54,0x08,0xd7,0x63,0x60,0x60,0x60,0x00, // compressed black pixel
    0x00,0x00,0x04,0x00,0x01,0x27,0x07,0x17, // CRC
    0xb5,0x00,0x00,0x00,0x00,0x49,0x45,0x4e, // IEND
    0x44,0xae,0x42,0x60,0x82,               // IEND CRC
  ]);
  await fs.promises.writeFile(outputPath, BLACK_PNG);
}

/**
 * Convert an MP3/audio file to an MP4 video.
 * Creates a solid black background (or uses a provided background image),
 * adds an audio-reactive wave overlay, overlays the logo if provided, and muxes the audio in.
 * videoFormat: landscape (1920x1080) | shorts (1080x1920) | square (1080x1080)
 */
export async function audioToVideo(
  videoId: string,
  audioApiPath: string,
  videoFormat: string = "landscape",
  logoApiPath?: string,
  bgImageApiPath?: string,
  onProgress?: (percent: number) => void
): Promise<string> {
  const audioAbs = getAbsolutePath(audioApiPath);
  const { w, h } = VIDEO_RESOLUTIONS[videoFormat] ?? VIDEO_RESOLUTIONS.landscape;
  const tmpDir = path.resolve(process.env.LOCAL_STORAGE_PATH || "./storage", videoId);
  await fs.promises.mkdir(tmpDir, { recursive: true });
  const outputPath = path.join(tmpDir, "video_from_audio.mp4");

  // Get audio duration first
  const duration = await new Promise<number>((resolve, reject) => {
    ffmpeg.ffprobe(audioAbs, (err, meta) => {
      if (err) reject(err);
      else resolve(meta.format.duration ?? 0);
    });
  });

  // Create a black PNG background image using raw pixel data
  const bgImagePath = path.join(tmpDir, "bg.png");
  if (!bgImageApiPath) {
    await createBlackPng(bgImagePath);
  }

  const bgAbs = bgImageApiPath ? getAbsolutePath(bgImageApiPath) : bgImagePath;

  const cmd = ffmpeg();
  cmd.input(bgAbs).inputOptions(["-loop 1"]);
  cmd.input(audioAbs);

  const filters: string[] = [];
  const isLongAudio = duration > 10 * 60;
  const fps = isLongAudio ? 15 : 24;
  const waveHeight = Math.max(140, Math.floor(h * (isLongAudio ? 0.14 : 0.2)));
  const waveBottomMargin = Math.max(28, Math.floor(h * 0.06));
  const videoPreset = isLongAudio ? "ultrafast" : "veryfast";
  const videoCrf = isLongAudio ? 30 : 28;

  if (bgImageApiPath) {
    filters.push(`[0:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1,format=yuv420p[bg]`);
  } else {
    filters.push(`[0:v]scale=${w}:${h},setsar=1,format=yuv420p[bg]`);
  }

  // Build a lighter wave strip near bottom (faster than full-frame blend on long audio).
  filters.push(
    `[1:a]aformat=channel_layouts=mono,showwaves=s=${w}x${waveHeight}:mode=cline:colors=0x59c8ff|0x8dffd1:rate=${fps},format=rgba,colorchannelmixer=aa=0.72[waves]`
  );
  filters.push(`[bg][waves]overlay=0:H-h-${waveBottomMargin}:format=auto[base]`);

  if (logoApiPath) {
    const logoAbs = getAbsolutePath(logoApiPath);
    cmd.input(logoAbs);
    filters.push(`[2:v]scale=iw*0.10:-1[logo]`);
    filters.push(`[base][logo]overlay=(main_w-overlay_w)/2:(main_h-overlay_h)/2[v]`);
  } else {
    filters.push(`[base]copy[v]`);
  }

  await new Promise<void>((resolve, reject) => {
    cmd
      .complexFilter(filters)
      .outputOptions([
        "-map [v]",
        "-map 1:a",
        "-c:v libx264",
        "-preset", videoPreset,
        "-crf", String(videoCrf),
        "-r", String(fps),
        "-threads 0",
        "-c:a aac",
        "-b:a 128k",
        "-shortest",
        "-pix_fmt yuv420p",
        "-movflags +faststart",
      ])
      .output(outputPath)
      .on("progress", (progress) => {
        if (onProgress && duration > 0) {
          const timemark = progress.timemark ?? "0:0:0";
          const parts = timemark.split(":").map(Number);
          const secs = (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0);
          onProgress(Math.min(99, Math.round((secs / duration) * 100)));
        }
      })
      .on("end", () => { onProgress?.(100); resolve(); })
      .on("error", (err) => reject(new Error(`audioToVideo failed: ${err.message}`)))
      .run();
  });

  const buffer = await fs.promises.readFile(outputPath);
  return saveFile(buffer, videoId, "video.mp4", "video/mp4");
}

/**
 * Stamp a channel logo (PNG/JPG) in the center of a video.
 * logoSize: percentage of video width (default 10%)
 */
export async function overlayLogo(
  videoId: string,
  videoApiPath: string,
  logoApiPath: string,
  logoSize: number = 0.10
): Promise<string> {
  const videoAbs = getAbsolutePath(videoApiPath);
  const logoAbs = getAbsolutePath(logoApiPath);
  const tmpDir = path.resolve(process.env.LOCAL_STORAGE_PATH || "./storage", videoId);
  await fs.promises.mkdir(tmpDir, { recursive: true });
  const outputPath = path.join(tmpDir, "video_logo.mp4");

  // Scale logo to 10% of video width, place centered.
  const logoW = `iw*${logoSize}`;
  const logoX = `(main_w-overlay_w)/2`;
  const logoY = `(main_h-overlay_h)/2`;

  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(videoAbs)
      .input(logoAbs)
      .complexFilter([
        `[1:v]scale=${logoW}:-1[logo]`,
        `[0:v][logo]overlay=${logoX}:${logoY}:format=auto[v]`,
      ])
      .outputOptions([
        "-map [v]",
        "-map 0:a?",
        "-c:v libx264",
        "-preset veryfast",
        "-crf 23",
        "-threads 0",
        "-c:a copy",
        "-movflags +faststart",
      ])
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (err) => reject(new Error(`overlayLogo failed: ${err.message}`)))
      .run();
  });

  const buffer = await fs.promises.readFile(outputPath);
  return saveFile(buffer, videoId, "video_logo.mp4", "video/mp4");
}

/**
 * Mix a custom uploaded audio/mp4 as background music under the video.
 * Identical to mixBackgroundMusic but accepts any audio source.
 */
export async function mixCustomBgMusic(
  videoId: string,
  videoApiPath: string,
  musicApiPath: string,
  musicVolume: number = 0.12
): Promise<string> {
  return mixBackgroundMusic(videoId, videoApiPath, musicApiPath, musicVolume);
}

/**
 * Convert a video to a different format (landscape ↔ shorts ↔ square).
 * Uses a blurred/scaled copy of the source as background to fill letterbox areas.
 */
export async function convertVideoFormat(
  videoId: string,
  inputApiPath: string,
  targetFormat: string
): Promise<string> {
  const absInput = getAbsolutePath(inputApiPath);
  const { w, h } = VIDEO_RESOLUTIONS[targetFormat] ?? VIDEO_RESOLUTIONS.landscape;
  const outputFilename = `converted_${targetFormat}.mp4`;
  const dir = path.resolve(process.env.LOCAL_STORAGE_PATH || "./storage", videoId);
  await fs.promises.mkdir(dir, { recursive: true });
  const absOutput = path.join(dir, outputFilename);

  return new Promise((resolve, reject) => {
    // Blurred background + sharp foreground (looks much better than black bars)
    ffmpeg(absInput)
      .complexFilter([
        // Scale blurred background to fill target resolution
        `[0:v]scale=${w}:${h},boxblur=20:3[bg]`,
        // Scale foreground to fit inside target resolution (keep aspect ratio)
        `[0:v]scale=${w}:${h}:force_original_aspect_ratio=decrease[fg]`,
        // Overlay foreground centered on blurred background
        `[bg][fg]overlay=(W-w)/2:(H-h)/2[v]`,
      ])
      .outputOptions([
        "-map [v]",
        "-map 0:a?",        // keep audio if present
        "-c:v libx264",
        "-preset fast",
        "-crf 23",
        "-c:a aac",
        "-movflags +faststart",
      ])
      .output(absOutput)
      .on("end", () => resolve(`/api/files/${videoId}/${outputFilename}`))
      .on("error", reject)
      .run();
  });
}

export async function getAudioDuration(audioApiPath: string): Promise<number> {
  const absPath = getAbsolutePath(audioApiPath);
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(absPath, (err, metadata) => {
      if (err) reject(err);
      else resolve(metadata.format.duration || 60);
    });
  });
}
