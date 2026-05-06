import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { verifySignedPublicFilePath } from "@/lib/publicFiles";

const BASE_PATH = path.resolve(process.env.LOCAL_STORAGE_PATH || "./storage");

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
  const expiresRaw = req.nextUrl.searchParams.get("e");
  const signature = req.nextUrl.searchParams.get("sig") || "";
  const expires = Number(expiresRaw);

  if (!Number.isFinite(expires) || !signature) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (Math.floor(Date.now() / 1000) > expires) {
    return new NextResponse("Link expired", { status: 401 });
  }

  const publicPath = `/api/public/files/${params.path.join("/")}`;
  if (!verifySignedPublicFilePath(publicPath, expires, signature)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const filePath = path.join(BASE_PATH, ...params.path);
  const resolved = path.resolve(filePath);
  if (!(resolved === BASE_PATH || resolved.startsWith(`${BASE_PATH}${path.sep}`))) {
    return new NextResponse("Invalid path", { status: 400 });
  }

  const ext = path.extname(resolved).slice(1).toLowerCase();
  const mimeType = MIME_TYPES[ext] || "application/octet-stream";

  let stat: fs.Stats;
  try {
    stat = await fs.promises.stat(resolved);
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  const fileSize = stat.size;
  const rangeHeader = req.headers.get("range");
  const commonHeaders = {
    "Content-Type": mimeType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=300",
  };

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
    const fileHandle = await fs.promises.open(resolved, "r");
    const buffer = Buffer.allocUnsafe(chunkSize);
    await fileHandle.read(buffer, 0, chunkSize, start);
    await fileHandle.close();

    return new NextResponse(buffer, {
      status: 206,
      headers: {
        ...commonHeaders,
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Content-Length": String(chunkSize),
      },
    });
  }

  const buffer = await fs.promises.readFile(resolved);
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      ...commonHeaders,
      "Content-Length": String(fileSize),
    },
  });
}
