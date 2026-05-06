import * as fs from "fs";
import * as path from "path";

const BASE_PATH = path.resolve(process.env.LOCAL_STORAGE_PATH || "./storage");

export async function saveFile(
  buffer: Buffer,
  videoId: string,
  filename: string,
  _mimeType: string
): Promise<string> {
  const dir = path.join(BASE_PATH, videoId);
  await fs.promises.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, filename);
  await fs.promises.writeFile(filePath, buffer);
  return `/api/files/${videoId}/${filename}`;
}

export function getAbsolutePath(apiPath: string): string {
  const relative = apiPath.replace("/api/files/", "");
  return path.join(BASE_PATH, relative);
}
