import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { researchTopic, ContentType } from "@/lib/claude";

const STORY_ANGLES_EN = [
  "a terrifying true story with real documented evidence",
  "the dark history and real events behind it",
  "a real case study with names, dates and places",
  "eyewitness accounts from real people",
  "the most chilling unsolved mystery",
  "what investigators actually found",
  "the story mainstream media ignored",
  "a step-by-step breakdown of what really happened",
];

const STORY_ANGLES_HI = [
  "एक सच्ची और प्रमाणित रहस्यमय घटना",
  "इसके पीछे की असली और अंधेरी कहानी",
  "असली नाम, तारीख और जगह के साथ",
  "चश्मदीद गवाहों के बयान",
  "सबसे रहस्यमय अनसुलझा मामला",
  "जाँचकर्ताओं ने असल में क्या पाया",
  "वो कहानी जो मीडिया ने छुपाई",
];

const FACTS_ANGLES_EN = [
  "surprising facts most people don't know",
  "the science behind it explained simply",
  "top myths debunked with real evidence",
  "mind-blowing statistics that will shock you",
  "the expert secrets nobody tells you",
  "how this works — step by step",
  "the biggest misconceptions corrected",
];

const FACTS_ANGLES_HI = [
  "जो तथ्य ज़्यादातर लोग नहीं जानते",
  "इसके पीछे का विज्ञान आसान भाषा में",
  "सबसे बड़े मिथक जो सच नहीं हैं",
  "चौंकाने वाले आँकड़े जो हैरान कर देंगे",
  "विशेषज्ञों के छिपे हुए राज़",
  "यह कैसे काम करता है — कदम दर कदम",
];

export async function POST(req: NextRequest, { params }: { params: { seriesId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const series = await prisma.series.findFirst({
    where: { id: params.seriesId, userId },
  });
  if (!series) return NextResponse.json({ error: "Series not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const contentType: ContentType = body?.contentType === "facts" ? "facts" : "story";
  const topicHint: string | undefined = body?.topicHint;
  const isHindi = series.language === "hi";

  const angles = contentType === "story"
    ? (isHindi ? STORY_ANGLES_HI : STORY_ANGLES_EN)
    : (isHindi ? FACTS_ANGLES_HI : FACTS_ANGLES_EN);

  const angle = topicHint ?? angles[Math.floor(Math.random() * angles.length)];
  const research = await researchTopic(series.niche, angle, series.language, contentType);

  return NextResponse.json({ research, angle, contentType });
}
