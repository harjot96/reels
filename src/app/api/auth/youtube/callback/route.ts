import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOAuthClient, encrypt } from "@/lib/youtube";
import { prisma } from "@/lib/prisma";
import { google } from "googleapis";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.redirect(new URL("/login", req.url));

  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/settings/youtube?error=no_code", req.url));

  try {
    const client = getOAuthClient();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    if (!tokens.access_token) throw new Error("No access_token returned from Google");
    if (!tokens.refresh_token) throw new Error("No refresh_token returned — revoke app access at myaccount.google.com/permissions and try again");

    const youtube = google.youtube({ version: "v3", auth: client });
    const channelRes = await youtube.channels.list({ part: ["snippet"], mine: true });
    const channel = channelRes.data.items?.[0];
    const userId = (session.user as { id: string }).id;

    await prisma.youtubeAccount.upsert({
      where: { userId },
      create: {
        userId,
        channelId: channel?.id || "",
        channelName: channel?.snippet?.title || "Unknown Channel",
        accessToken: encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token),
        tokenExpiry: new Date(tokens.expiry_date ?? Date.now() + 3600 * 1000),
      },
      update: {
        channelId: channel?.id || "",
        channelName: channel?.snippet?.title || "Unknown Channel",
        accessToken: encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token),
        tokenExpiry: new Date(tokens.expiry_date ?? Date.now() + 3600 * 1000),
      },
    });

    return NextResponse.redirect(new URL("/settings/youtube?success=true", req.url));
  } catch (error) {
    const msg = error instanceof Error ? error.message : "OAuth failed";
    console.error("[YouTube OAuth]", msg);
    const url = new URL("/settings/youtube", req.url);
    url.searchParams.set("error", msg);
    return NextResponse.redirect(url);
  }
}
