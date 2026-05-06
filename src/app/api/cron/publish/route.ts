import { NextRequest, NextResponse } from "next/server";
import { runScheduledPublishes } from "@/lib/scheduler";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("Authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await runScheduledPublishes();
  return NextResponse.json({ processed: results.length, results });
}
