import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectInstagramFromCode } from "@/lib/instagram";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.redirect(new URL("/login", req.url));

  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/settings/instagram?error=no_code", req.url));

  try {
    const userId = (session.user as { id: string }).id;
    const state = req.nextUrl.searchParams.get("state");
    if (state && state !== userId) {
      throw new Error("Invalid OAuth state");
    }
    await connectInstagramFromCode(userId, code);
    return NextResponse.redirect(new URL("/settings/instagram?success=true", req.url));
  } catch (error) {
    const msg = error instanceof Error ? error.message : "OAuth failed";
    console.error("[Instagram OAuth]", msg);
    const url = new URL("/settings/instagram", req.url);
    url.searchParams.set("error", msg);
    return NextResponse.redirect(url);
  }
}
