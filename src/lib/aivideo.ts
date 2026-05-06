import Replicate from "replicate";
import { saveFile } from "./storage";
import * as path from "path";
import * as fs from "fs";

const replicate = new Replicate({ auth: process.env.REPLICATE_API_KEY });

// ── HuggingFace free video generation ────────────────────────────────────────

/**
 * Generate a short video clip using HuggingFace Inference API (free).
 * Uses damo-vilab/text-to-video-ms-1.7b — no cost, just needs HUGGINGFACE_API_KEY.
 * Returns a local file path.
 */
export async function generateHFVideoClip(
  visualPrompt: string,
  videoId: string,
  index: number
): Promise<string> {
  const model = "damo-vilab/text-to-video-ms-1.7b";

  const res = await fetch(`https://router.huggingface.co/models/${model}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ inputs: visualPrompt }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HuggingFace video error: ${err}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  return saveFile(buffer, videoId, `hfclip_${index}.mp4`, "video/mp4");
}

// Generate one consistent character description that will be used across ALL clips
export async function generateCharacterDescription(
  niche: string,
  style: string
): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 200,
      messages: [{
        role: "user",
        content: `Create a short, specific visual character description for a YouTube video about "${niche}" in "${style}" visual style.

Describe ONE consistent human character who will appear throughout ALL video clips:
- Age, gender, skin tone
- Exact hair (color, length, style)
- Exact outfit (colors, type of clothing)
- Background/setting they appear in

Write 2 sentences max. Be very specific — this will be used as a visual prompt prefix for AI video generation to keep the character the same across clips.

Output ONLY the character description, no explanation.`,
      }],
    }),
  });

  if (!response.ok) throw new Error(`Claude error generating character: ${response.status}`);
  const data = await response.json() as { content: { type: string; text: string }[] };
  return data.content[0].text.trim();
}

// Generate a short AI video clip via Replicate (minimax/video-01)
export async function generateAIVideoClip(
  visualPrompt: string,
  characterDescription: string,
  videoId: string,
  index: number,
  videoFormat: string = "landscape"
): Promise<string> {
  const aspectMap: Record<string, string> = {
    landscape: "16:9",
    shorts: "9:16",
    square: "1:1",
  };
  const aspectRatio = aspectMap[videoFormat] ?? "16:9";

  const fullPrompt = `${characterDescription} ${visualPrompt}. ${aspectRatio} aspect ratio. Cinematic lighting, smooth motion, high quality, realistic.`;

  // Use minimax/video-01 — generates ~5s clips, text-to-video
  const output = await replicate.run("minimax/video-01", {
    input: {
      prompt: fullPrompt,
      prompt_optimizer: true,
    },
  }) as string | string[] | { url?: string };

  // Extract URL from output (Replicate returns different shapes)
  let videoUrl: string;
  if (typeof output === "string") {
    videoUrl = output;
  } else if (Array.isArray(output)) {
    videoUrl = output[0] as string;
  } else if (output && typeof (output as { url?: string }).url === "string") {
    videoUrl = (output as { url: string }).url;
  } else {
    throw new Error("Unexpected Replicate output format");
  }

  const res = await fetch(videoUrl);
  if (!res.ok) throw new Error(`Failed to download AI clip: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());

  return saveFile(buffer, videoId, `aiclip_${index}.mp4`, "video/mp4");
}
