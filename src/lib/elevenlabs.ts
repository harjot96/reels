import * as path from "path";
import * as fs from "fs";
import { saveFile } from "./storage";

const CHUNK_LIMIT = 4096;

// ── Helpers ──────────────────────────────────────────────────────────────────

function splitIntoChunks(text: string, limit = CHUNK_LIMIT): string[] {
  const sentences = text.match(/[^.!?।]+[.!?।]+/g) ?? [text];
  const chunks: string[] = [];
  let current = "";
  for (const s of sentences) {
    if ((current + s).length > limit) {
      if (current) chunks.push(current.trim());
      current = s;
    } else {
      current += s;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length ? chunks : [text];
}

async function concatBuffers(videoId: string, buffers: Buffer[], ext: string): Promise<string> {
  const { concatAudioChunks } = await import("./ffmpeg");
  const dir = path.resolve(process.env.LOCAL_STORAGE_PATH || "./storage", videoId);
  await fs.promises.mkdir(dir, { recursive: true });
  const paths: string[] = [];
  for (let i = 0; i < buffers.length; i++) {
    const p = path.join(dir, `audio_chunk_${i}.${ext}`);
    await fs.promises.writeFile(p, buffers[i]);
    paths.push(p);
  }
  return concatAudioChunks(videoId, paths);
}

/** Run an array of async tasks in parallel, max `concurrency` at a time */
async function parallelMap<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, i: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;

  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i], i);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

// ── Provider 1: ElevenLabs ────────────────────────────────────────────────────

async function elChunk(text: string, voiceId: string, modelId: string): Promise<Buffer> {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: modelId, voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
  });
  if (!res.ok) throw new Error(`ElevenLabs error: ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

async function generateWithElevenLabs(text: string, voiceId: string, videoId: string, language: string): Promise<string> {
  const modelId = ["hi", "pa"].includes(language) || language !== "en" ? "eleven_multilingual_v2" : "eleven_flash_v2_5";
  if (text.length <= CHUNK_LIMIT) {
    return saveFile(await elChunk(text, voiceId, modelId), videoId, "audio.mp3", "audio/mpeg");
  }
  // ElevenLabs rate-limits concurrent requests — 3 at a time is safe on free tier
  const buffers = await parallelMap(splitIntoChunks(text), 3, (c) => elChunk(c, voiceId, modelId));
  return concatBuffers(videoId, buffers, "mp3");
}

// ── Provider 2: Edge TTS (Microsoft — completely free, no API key) ────────────

// Hindi voices: hi-IN-MadhurNeural (male), hi-IN-SwaraNeural (female)
// English voices: en-US-GuyNeural, en-US-JennyNeural, en-GB-RyanNeural, etc.
const EDGE_VOICES: Record<string, string> = {
  en: "en-US-GuyNeural",
  hi: "hi-IN-MadhurNeural",
  pa: "hi-IN-MadhurNeural", // No native Punjabi in Edge TTS — Hindi is closest
};

function edgeChunkToBuffer(tts: import("msedge-tts").MsEdgeTTS, text: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const parts: Buffer[] = [];
    // msedge-tts v2 returns { audioStream, metadataStream, requestId }
    const result = tts.toStream(text) as any;
    const readable = result?.audioStream ?? result;
    readable.on("data", (d: Buffer) => parts.push(d));
    readable.on("end", () => resolve(Buffer.concat(parts)));
    readable.on("error", reject);
  });
}

async function generateWithEdgeTTS(text: string, videoId: string, language: string): Promise<string> {
  const { MsEdgeTTS, OUTPUT_FORMAT } = await import("msedge-tts");
  const voice = EDGE_VOICES[language] ?? EDGE_VOICES.en;

  const dir = path.resolve(process.env.LOCAL_STORAGE_PATH || "./storage", videoId);
  await fs.promises.mkdir(dir, { recursive: true });

  const chunks = text.length > 3000 ? splitIntoChunks(text, 3000) : [text];

  if (chunks.length === 1) {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    return saveFile(await edgeChunkToBuffer(tts, text), videoId, "audio.mp3", "audio/mpeg");
  }

  // Edge TTS: no rate limits — generate all chunks fully in parallel
  const buffers = await parallelMap(chunks, chunks.length, async (chunk) => {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    return edgeChunkToBuffer(tts, chunk);
  });
  return concatBuffers(videoId, buffers, "mp3");
}

// ── Provider 3: HuggingFace MMS TTS (free with API key) ──────────────────────

// facebook/mms-tts supports 1100+ languages including Hindi
const HF_TTS_MODELS: Record<string, string> = {
  en: "facebook/mms-tts-eng",
  hi: "facebook/mms-tts-hin",
  pa: "facebook/mms-tts-pan", // Eastern Punjabi (Gurmukhi script)
};

async function hfChunk(text: string, model: string): Promise<Buffer> {
  const res = await fetch(`https://router.huggingface.co/models/${model}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ inputs: text }),
  });
  if (!res.ok) throw new Error(`HuggingFace TTS error: ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

async function generateWithHuggingFace(text: string, videoId: string, language: string): Promise<string> {
  const model = HF_TTS_MODELS[language] ?? HF_TTS_MODELS.en;
  const chunks = splitIntoChunks(text, 400);
  // HuggingFace free tier allows ~5 concurrent requests
  const buffers = await parallelMap(chunks, 5, (c) => hfChunk(c, model));
  if (buffers.length === 1) return saveFile(buffers[0], videoId, "audio.flac", "audio/flac");
  return concatBuffers(videoId, buffers, "flac");
}

// ── OpenAI TTS (paid fallback) ────────────────────────────────────────────────

const EL_TO_OPENAI: Record<string, string> = {
  EXAVITQu4vr4xnSDxMaL: "nova",
  TxGEqnHWrfWFTfGW9XjX: "onyx",
  VR6AewLTigWG4xSOukaG: "echo",
  pNInz6obpgDQGcFmaJgB: "fable",
  TX3LPaxmHKxFdv7VOQHJ: "echo",
  XB0fDUnXU5powFXDhCwa: "shimmer",
  Xb7hH8MSUJpSbSDYk0k2: "alloy",
  iP95p4xoKVk53GoZ742B: "fable",
};

async function openAIChunk(text: string, voice: string): Promise<Buffer> {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "tts-1", input: text, voice, response_format: "mp3" }),
  });
  if (!res.ok) throw new Error(`OpenAI TTS error: ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

async function generateWithOpenAI(text: string, voiceId: string, videoId: string): Promise<string> {
  const voice = EL_TO_OPENAI[voiceId] ?? "onyx";
  // OpenAI allows up to 5 parallel TTS requests on standard tier
  const buffers = await parallelMap(splitIntoChunks(text), 5, (c) => openAIChunk(c, voice));
  if (buffers.length === 1) return saveFile(buffers[0], videoId, "audio.mp3", "audio/mpeg");
  return concatBuffers(videoId, buffers, "mp3");
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate audio with automatic provider selection and fallback.
 *
 * Free options (no cost):
 *   Edge TTS  — Microsoft neural voices, no API key required (best free quality)
 *   HuggingFace — facebook/mms-tts, free with HUGGINGFACE_API_KEY
 *
 * Paid options (better voices):
 *   ElevenLabs — ELEVENLABS_API_KEY ($5/mo)
 *   OpenAI TTS — OPENAI_API_KEY ($0.015/1K chars)
 *
 * Set TTS_PROVIDER=edge|huggingface|elevenlabs|openai in .env to force a provider.
 * Otherwise: ElevenLabs → Edge TTS → HuggingFace → OpenAI
 */
/** Strip markdown/formatting so TTS only speaks natural text */
function cleanText(text: string): string {
  return text
    .replace(/\*\*([^*]*)\*\*/g, "$1")
    .replace(/\*([^*]*)\*/g, "$1")
    .replace(/_{1,2}([^_]*)_{1,2}/g, "$1")
    .replace(/\[([^\]]*)\]/g, "$1")
    .replace(/#{1,6}\s*/g, "")
    .replace(/`[^`]*`/g, "")
    .replace(/---+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export async function generateAudio(
  text: string,
  voiceId: string,
  videoId: string,
  language: string = "en",
  providerOverride?: string   // per-series override from DB
): Promise<string> {
  text = cleanText(text); // always strip markdown before TTS

  const forced = (providerOverride && providerOverride !== "auto")
    ? providerOverride.toLowerCase()
    : process.env.TTS_PROVIDER?.toLowerCase();

  const has = (key: string, skip = "replace") =>
    !!(process.env[key] && !process.env[key]!.startsWith(skip));

  // Forced provider
  if (forced === "edge")         return generateWithEdgeTTS(text, videoId, language);
  if (forced === "huggingface")  return generateWithHuggingFace(text, videoId, language);
  if (forced === "openai")       return generateWithOpenAI(text, voiceId, videoId);
  if (forced === "elevenlabs")   return generateWithElevenLabs(text, voiceId, videoId, language);

  // Auto cascade: ElevenLabs → Edge TTS → HuggingFace → OpenAI
  if (has("ELEVENLABS_API_KEY")) {
    try {
      return await generateWithElevenLabs(text, voiceId, videoId, language);
    } catch (err) {
      const msg = String(err);
      const blocked = msg.includes("detected_unusual_activity") || msg.includes("Free Tier") || msg.includes("401") || msg.includes("429");
      if (!blocked) throw err;
      console.warn("[TTS] ElevenLabs blocked → trying Edge TTS");
    }
  }

  // Edge TTS — always available, no key needed
  try {
    return await generateWithEdgeTTS(text, videoId, language);
  } catch (err) {
    console.warn("[TTS] Edge TTS failed →", err);
  }

  if (has("HUGGINGFACE_API_KEY", "hf_...")) {
    try {
      return await generateWithHuggingFace(text, videoId, language);
    } catch (err) {
      console.warn("[TTS] HuggingFace TTS failed →", err);
    }
  }

  if (has("OPENAI_API_KEY", "sk-...")) {
    return generateWithOpenAI(text, voiceId, videoId);
  }

  // Edge TTS needs no key — this is always a valid last resort
  return generateWithEdgeTTS(text, videoId, language);
}
