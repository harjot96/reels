import { saveFile } from "./storage";

const DIMENSIONS: Record<string, { width: number; height: number; aspect: string }> = {
  landscape: { width: 1344, height: 768,  aspect: "16:9 widescreen" },
  shorts:    { width: 768,  height: 1344, aspect: "9:16 vertical portrait" },
  square:    { width: 1024, height: 1024, aspect: "1:1 square" },
};

// Extract short keyword for fallback searches
function toKeyword(prompt: string): string {
  return prompt.split(",")[0].trim().split(" ").slice(0, 3).join(" ");
}

// HuggingFace Inference API — free tier with API key
async function generateWithHuggingFace(fullPrompt: string, width: number, height: number): Promise<Buffer> {
  const response = await fetch(
    "https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-xl-base-1.0",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: fullPrompt, parameters: { width, height } }),
    }
  );
  if (!response.ok) throw new Error(`HuggingFace error: ${await response.text()}`);
  return Buffer.from(await response.arrayBuffer());
}

// Lexica.art — search existing AI-generated images, completely free, no key needed
async function generateWithLexica(prompt: string): Promise<Buffer> {
  const keyword = toKeyword(prompt);
  const searchRes = await fetch(
    `https://lexica.art/api/v1/search?q=${encodeURIComponent(keyword)}`,
    { headers: { "User-Agent": "Mozilla/5.0" } }
  );
  if (!searchRes.ok) throw new Error(`Lexica search failed: ${searchRes.status}`);
  const data = await searchRes.json();
  const images: Array<{ src: string }> = data.images ?? [];
  if (images.length === 0) throw new Error("Lexica: no images found");
  const pick = images[Math.floor(Math.random() * Math.min(8, images.length))];
  const imgRes = await fetch(pick.src, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!imgRes.ok) throw new Error(`Lexica download failed: ${imgRes.status}`);
  return Buffer.from(await imgRes.arrayBuffer());
}

// Unsplash — free relevant stock photos, no key needed via source URL
async function generateWithUnsplash(prompt: string, width: number, height: number): Promise<Buffer> {
  const keyword = encodeURIComponent(toKeyword(prompt));
  const url = `https://source.unsplash.com/${width}x${height}/?${keyword}`;
  const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, redirect: "follow" });
  if (!response.ok) throw new Error(`Unsplash error: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

// Picsum — guaranteed random photo, always works, no key needed
async function generateWithPicsum(width: number, height: number): Promise<Buffer> {
  const url = `https://picsum.photos/${width}/${height}?random=${Date.now()}`;
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`Picsum error: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

export async function generateImage(
  prompt: string,
  imageStyle: string,
  videoId: string,
  index: number,
  videoFormat: string = "landscape"
): Promise<string> {
  const { width, height, aspect } = DIMENSIONS[videoFormat] ?? DIMENSIONS.landscape;
  const fullPrompt = `${prompt}, ${imageStyle}, cinematic, ${aspect}, high quality`;

  const hfKey = process.env.HUGGINGFACE_API_KEY;
  const hasHf = !!(hfKey && hfKey.startsWith("hf_") && hfKey.length > 10);

  const sources = [
    ...(hasHf ? [() => generateWithHuggingFace(fullPrompt, width, height)] : []),
    () => generateWithLexica(prompt),
    () => generateWithUnsplash(prompt, width, height),
    () => generateWithPicsum(width, height),
  ];

  let lastError: Error = new Error("All image sources failed");
  for (const source of sources) {
    try {
      const buffer = await source();
      const filePath = await saveFile(buffer, videoId, `image_${index}.png`, "image/png");
      return filePath;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastError;
}
