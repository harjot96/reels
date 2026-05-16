import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest): Promise<NextResponse> {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await req.json()) as HandleUploadBody;

    try {
          const jsonResponse = await handleUpload({
                  body,
                  request: req,
                  onBeforeGenerateToken: async (pathname) => ({
                            allowedContentTypes: ["video/mp4", "video/quicktime", "video/x-msvideo", "video/webm", "video/mkv", "video/x-matroska", "video/mpeg", "video/x-m4v", "audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg", "audio/m4a", "audio/flac", "audio/aac"],
                            maximumSizeInBytes: 2 * 1024 * 1024 * 1024,
                            tokenPayload: JSON.stringify({ userId }),
                          }),
                  onUploadCompleted: async ({ blob, tokenPayload }) => {
                            const { userId: uid } = JSON.parse(tokenPayload ?? "{}");
                            const url = new URL(req.url);
                            const seriesId = url.searchParams.get("seriesId");
                            const title = url.searchParams.get("title") ?? blob.pathname.split("/").pop() ?? "Untitled";
                            const videoFormat = url.searchParams.get("videoFormat") ?? "landscape";

                            let series;
                            if (seriesId) {
                                        series = await prisma.series.findFirst({ where: { id: seriesId, userId: uid } });
                                      }
                            if (!series) {
                                        series = await prisma.series.findFirst({ where: { userId: uid, title: "Direct Uploads" } });
                                      }
                            if (!series) {
                                        series = await prisma.series.create({
                                                      data: { userId: uid, title: "Direct Uploads", niche: "Direct video uploads", videoFormat, status: "ACTIVE" },
                                                    });
                                      }

                            const isVideo = blob.contentType?.startsWith("video/");
                            await prisma.video.create({
                                        data: {
                                                      seriesId: series.id,
                                                      title,
                                                      videoUrl: blob.url,
                                                      audioUrl: isVideo ? undefined : blob.url,
                                                      status: "READY",
                                                    },
                                      });
                          },
                });
          return NextResponse.json(jsonResponse);
        } catch (error) {
          return NextResponse.json({ error: (error as Error).message }, { status: 400 });
        }
  }
