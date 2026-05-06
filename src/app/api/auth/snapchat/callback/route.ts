import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectSnapchatFromCode } from "@/lib/snapchat";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.redirect(new URL("/login", req.url));

  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/settings/snapchat?error=no_code", req.url));

  try {
    const userId = (session.user as { id: string }).id;
    const state = req.nextUrl.searchParams.get("state");
    if (state && state !== userId) throw new Error("Invalid OAuth state");

    await connectSnapchatFromCode(userId, code);
    return NextResponse.redirect(new URL("/settings/snapchat?success=true", req.url));
  } catch (error) {
    const msg = error instanceof Error ? error.message : "OAuth failed";
    console.error("[Snapchat OAuth]", msg);
    const url = new URL("/settings/snapchat", req.url);
    url.searchParams.set("error", msg);
    return NextResponse.redirect(url);
  }
}
