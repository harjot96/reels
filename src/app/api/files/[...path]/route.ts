import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const BASE_PATH = process.env.LOCAL_STORAGE_PATH || "./storage";

const MIME_TYPES: Record<string, string> = {
  mp4: "video/mp4",
  mp3: "audio/mpeg",
  webm: "video/webm",
  ogg: "audio/ogg",
  flac: "audio/flac",
  wav: "audio/wav",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  srt: "text/plain",
};

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const filePath = path.join(path.resolve(BASE_PATH), ...params.path);
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const mimeType = MIME_TYPES[ext] || "application/octet-stream";

  let stat: fs.Stats;
  try {
    stat = await fs.promises.stat(filePath);
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  const fileSize = stat.size;
  const rangeHeader = req.headers.get("range");

  // ── Range request (required for audio/video seeking in browsers) ──────────
  if (rangeHeader) {
    const [unit, range] = rangeHeader.split("=");
    if (unit !== "bytes") {
      return new NextResponse("Invalid range unit", { status: 416 });
    }

    const [startStr, endStr] = range.split("-");
    const start = parseInt(startStr, 10);
    const end = endStr ? parseInt(endStr, 10) : fileSize - 1;

    if (start > end || start >= fileSize || end >= fileSize) {
      return new NextResponse("Range Not Satisfiable", {
        status: 416,
        headers: { "Content-Range": `bytes */${fileSize}` },
      });
    }

    const chunkSize = end - start + 1;
    const fileHandle = await fs.promises.open(filePath, "r");
    const buffer = Buffer.allocUnsafe(chunkSize);
    await fileHandle.read(buffer, 0, chunkSize, start);
    await fileHandle.close();

    return new NextResponse(buffer, {
      status: 206,
      headers: {
        "Content-Type": mimeType,
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunkSize),
      },
    });
  }

  // ── Full file request ─────────────────────────────────────────────────────
  const buffer = await fs.promises.readFile(filePath);
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": mimeType,
      "Content-Length": String(fileSize),
      "Accept-Ranges": "bytes",
    },
  });
}
