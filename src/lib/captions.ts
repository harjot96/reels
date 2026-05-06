import type { ScriptSegment } from "./claude";

function toSRTTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.round((sec % 1) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}
function pad(n: number, len = 2) { return String(n).padStart(len, "0"); }

/**
 * Build an SRT caption file from script segments.
 * Timing is estimated by distributing totalDuration evenly across segments.
 */
export function buildSRT(segments: ScriptSegment[], totalDuration: number): string {
  const perSeg = totalDuration / segments.length;
  return segments
    .map((seg, i) => {
      const start = i * perSeg;
      const end = Math.min((i + 1) * perSeg - 0.1, totalDuration);
      return `${i + 1}\n${toSRTTime(start)} --> ${toSRTTime(end)}\n${seg.text.trim()}\n`;
    })
    .join("\n");
}

/**
 * Build YouTube-compatible chapter timestamps for the video description.
 * YouTube requires at least 3 chapters, first must start at 0:00.
 */
export function buildChapters(segments: ScriptSegment[], totalDuration: number): string {
  if (segments.length < 3) return "";
  const perSeg = totalDuration / segments.length;

  return segments
    .map((seg, i) => {
      const t = i * perSeg;
      const m = Math.floor(t / 60);
      const s = Math.floor(t % 60);
      // Use first 6 words of segment text as chapter label
      const label = seg.text.split(" ").slice(0, 6).join(" ").replace(/[^a-zA-Z0-9\u0900-\u097F ]/g, "").trim();
      return `${m}:${pad(s)} ${label || `Part ${i + 1}`}`;
    })
    .join("\n");
}
