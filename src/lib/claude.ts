export interface ScriptSegment {
  text: string;
  visualDescription: string;
}

export interface GeneratedScript {
  title: string;
  // Optional user-provided on-screen overlay title text.
  overlayTitle?: string;
  description?: string;
  tags: string[];
  hashtags: string[];
  segments: ScriptSegment[];
  fullText: string;
}

export type ContentType = "story" | "facts";

// Angles for real-story content
const STORY_ANGLES_EN = [
  "a terrifying true story with real documented evidence",
  "the dark history and real events behind it",
  "a real case study with names, dates and places",
  "eyewitness accounts from real people",
  "the most chilling unsolved mystery",
  "what investigators actually found",
  "the story mainstream media ignored",
  "a step-by-step breakdown of what really happened",
  "the truth nobody talks about",
  "a real incident that changed everything",
];

const STORY_ANGLES_HI = [
  "एक सच्ची और प्रमाणित रहस्यमय घटना",
  "इसके पीछे की असली और अंधेरी कहानी",
  "असली नाम, तारीख और जगह के साथ",
  "चश्मदीद गवाहों के बयान",
  "सबसे रहस्यमय अनसुलझा मामला",
  "जाँचकर्ताओं ने असल में क्या पाया",
  "वो कहानी जो मीडिया ने छुपाई",
  "असलियत में क्या हुआ — कदम दर कदम",
  "एक असली घटना जिसने सब बदल दिया",
];

const STORY_ANGLES_PA = [
  "ਇੱਕ ਸੱਚੀ ਅਤੇ ਪ੍ਰਮਾਣਿਤ ਰਹੱਸਮਈ ਘਟਨਾ",
  "ਇਸ ਦੇ ਪਿੱਛੇ ਦੀ ਅਸਲ ਅਤੇ ਹਨੇਰੀ ਕਹਾਣੀ",
  "ਅਸਲ ਨਾਮ, ਤਾਰੀਖ਼ ਅਤੇ ਜਗ੍ਹਾ ਦੇ ਨਾਲ",
  "ਚਸ਼ਮਦੀਦ ਗਵਾਹਾਂ ਦੇ ਬਿਆਨ",
  "ਸਭ ਤੋਂ ਰਹੱਸਮਈ ਅਣਸੁਲਝਿਆ ਮਾਮਲਾ",
  "ਜਾਂਚਕਰਤਾਵਾਂ ਨੇ ਅਸਲ ਵਿੱਚ ਕੀ ਲੱਭਿਆ",
  "ਉਹ ਕਹਾਣੀ ਜੋ ਮੀਡੀਆ ਨੇ ਲੁਕਾਈ",
  "ਅਸਲੀਅਤ ਵਿੱਚ ਕੀ ਹੋਇਆ — ਕਦਮ ਦਰ ਕਦਮ",
  "ਇੱਕ ਅਸਲ ਘਟਨਾ ਜਿਸਨੇ ਸਭ ਬਦਲ ਦਿੱਤਾ",
];

// Angles for facts content
const FACTS_ANGLES_EN = [
  "surprising facts most people don't know",
  "the science behind it explained simply",
  "top myths debunked with real evidence",
  "mind-blowing statistics that will shock you",
  "the expert secrets nobody tells you",
  "the complete beginner's guide with facts",
  "how this works — step by step",
  "the most surprising things researchers discovered",
  "facts that will change how you see this",
  "the biggest misconceptions corrected",
];

const FACTS_ANGLES_HI = [
  "जो तथ्य ज़्यादातर लोग नहीं जानते",
  "इसके पीछे का विज्ञान आसान भाषा में",
  "सबसे बड़े मिथक जो सच नहीं हैं",
  "चौंकाने वाले आँकड़े जो हैरान कर देंगे",
  "विशेषज्ञों के छिपे हुए राज़",
  "शुरुआती लोगों के लिए पूरी जानकारी",
  "यह कैसे काम करता है — कदम दर कदम",
  "शोधकर्ताओं ने जो सबसे चौंकाने वाली बात खोजी",
  "तथ्य जो आपका नज़रिया बदल देंगे",
  "सबसे बड़ी गलतफहमियाँ सुधारी गईं",
];

const FACTS_ANGLES_PA = [
  "ਉਹ ਤੱਥ ਜੋ ਜ਼ਿਆਦਾਤਰ ਲੋਕ ਨਹੀਂ ਜਾਣਦੇ",
  "ਇਸ ਦੇ ਪਿੱਛੇ ਦਾ ਵਿਗਿਆਨ ਸਰਲ ਭਾਸ਼ਾ ਵਿੱਚ",
  "ਸਭ ਤੋਂ ਵੱਡੀਆਂ ਗਲਤਫਹਿਮੀਆਂ ਜੋ ਸੱਚ ਨਹੀਂ",
  "ਹੈਰਾਨ ਕਰਨ ਵਾਲੇ ਅੰਕੜੇ ਜੋ ਤੁਹਾਨੂੰ ਚੌਂਕਾ ਦੇਣਗੇ",
  "ਮਾਹਰਾਂ ਦੇ ਲੁਕੇ ਹੋਏ ਰਾਜ਼",
  "ਸ਼ੁਰੂਆਤ ਕਰਨ ਵਾਲਿਆਂ ਲਈ ਪੂਰੀ ਜਾਣਕਾਰੀ",
  "ਇਹ ਕਿਵੇਂ ਕੰਮ ਕਰਦਾ ਹੈ — ਕਦਮ ਦਰ ਕਦਮ",
  "ਖੋਜਕਾਰਾਂ ਨੇ ਜੋ ਸਭ ਤੋਂ ਹੈਰਾਨੀਜਨਕ ਗੱਲ ਲੱਭੀ",
  "ਤੱਥ ਜੋ ਤੁਹਾਡਾ ਨਜ਼ਰੀਆ ਬਦਲ ਦੇਣਗੇ",
  "ਸਭ ਤੋਂ ਵੱਡੀਆਂ ਗਲਤਫਹਿਮੀਆਂ ਦੂਰ ਕੀਤੀਆਂ",
];

export interface SEOResult {
  titles: string[];          // 5 viral title options
  description: string;       // SEO-optimized description
  tags: string[];            // 15 high-traffic tags
  hashtags: string[];        // 10 trending hashtags
  hook: string;              // Rewritten first-5-second hook
  bestPostingTime: string;   // e.g. "Tuesday 7-9pm"
  tips: string[];            // 3 actionable tips for this video
}

export async function optimizeSEO(
  title: string,
  niche: string,
  script: string,
  language: string = "en"
): Promise<SEOResult> {
  const prompt = `You are a YouTube SEO expert who has grown channels to millions of views.

Analyze this video and generate maximum-CTR optimizations:

Niche: ${niche}
Current Title: ${title}
Language: ${language}
Script excerpt: ${script.slice(0, 600)}

Return ONLY valid JSON:
{
  "titles": ["5 viral title options — use numbers, curiosity gaps, emotional triggers, 'you won't believe', power words — max 60 chars each"],
  "description": "SEO-optimized 150-word description with keywords naturally embedded. Start with a hook sentence. Include a call to action.",
  "tags": ["15 high-traffic YouTube tags — mix broad and specific, include common misspellings"],
  "hashtags": ["#10trending", "#hashtags", "#formaxreach"],
  "hook": "Rewrite the opening 2 sentences to be irresistibly clickable — create curiosity, urgency or shock in the first 5 seconds",
  "bestPostingTime": "Best day and time to post for maximum reach (e.g. 'Tuesday 7-9pm')",
  "tips": ["3 specific actionable tips to get more views on this exact video"]
}`;

  const text = await callClaude(prompt, 1500);
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON in SEO response");
  return JSON.parse(match[0]) as SEOResult;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function callClaude(prompt: string, maxTokens: number = 2000): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API error: ${err}`);
  }

  const data = await response.json() as { content: { type: string; text: string }[] };
  const content = data.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");
  return content.text;
}

export async function researchTopic(
  niche: string,
  angle: string,
  language: string,
  contentType: ContentType = "story"
): Promise<string> {
  const isHindi = language === "hi";
  const isPunjabi = language === "pa";
  const isStory = contentType === "story";

  const prompt = isPunjabi
    ? isStory
      ? `ਤੁਸੀਂ ਇੱਕ ਡੂੰਘੇ ਖੋਜੀ ਪੱਤਰਕਾਰ ਹੋ। ਵਿਸ਼ਾ: "${niche}" — ਕੋਣ: "${angle}"

ਜ਼ਰੂਰੀ ਨਿਯਮ:
- ਤੁਹਾਨੂੰ ਇੱਕ ਖਾਸ, ਅਸਲ, ਦਸਤਾਵੇਜ਼ੀ ਘਟਨਾ ਚੁਣਨੀ ਹੋਵੇਗੀ — ਅਜਿਹੀ ਜੋ ਅਸਲ ਵਿੱਚ ਹੋਈ ਹੋਵੇ ਅਤੇ ਤਸਦੀਕਯੋਗ ਹੋਵੇ
- ਸਹੀ ਜਗ੍ਹਾ (ਸ਼ਹਿਰ, ਦੇਸ਼), ਸਹੀ ਸਾਲ/ਤਾਰੀਖ਼, ਅਤੇ ਸ਼ਾਮਲ ਲੋਕਾਂ ਦੇ ਅਸਲ ਨਾਮ ਦਿਓ
- ਕੋਈ ਵੀ ਵੇਰਵਾ ਘੜੋ ਜਾਂ ਮਨਘੜਤ ਨਾ ਕਰੋ — ਸਿਰਫ਼ ਉਹੀ ਤੱਥ ਵਰਤੋ ਜੋ ਤਸਦੀਕ ਕੀਤੇ ਜਾ ਸਕਦੇ ਹੋਣ
- ਅਸਪਸ਼ਟ ਨਾ ਹੋਵੋ — "ਭਾਰਤ ਦਾ ਕੋਈ ਪਿੰਡ" ਮਨਜ਼ੂਰ ਨਹੀਂ। "ਕੁਲਧਰਾ ਪਿੰਡ, ਰਾਜਸਥਾਨ, 1825 ਵਿੱਚ ਛੱਡਿਆ ਗਿਆ" ਮਨਜ਼ੂਰ ਹੈ

ਦਿਓ:
1. **ਮੁੱਖ ਘਟਨਾ**: ਸਭ ਤੋਂ ਹੈਰਾਨ ਕਰਨ ਵਾਲੀ ਅਸਲ ਘਟਨਾ — ਅਸਲ ਨਾਮ, ਤਾਰੀਖ਼, ਜਗ੍ਹਾ ਦੇ ਨਾਲ
2. **ਵਿਸਤ੍ਰਿਤ ਵੇਰਵਾ**: ਕੀ ਹੋਇਆ, ਕਦੋਂ ਹੋਇਆ, ਕਿਸ ਨਾਲ ਹੋਇਆ
3. **ਗਵਾਹ/ਸਬੂਤ**: ਕੀ ਸਬੂਤ ਮਿਲੇ, ਕਿਸਨੇ ਦੇਖਿਆ, ਕਿਸਨੇ ਰਿਪੋਰਟ ਕੀਤਾ
4. **ਜਾਂਚ/ਨਤੀਜਾ**: ਅਧਿਕਾਰੀਆਂ ਜਾਂ ਮਾਹਰਾਂ ਨੇ ਕੀ ਪਾਇਆ
5. **ਰਹੱਸ/ਅਣਸੁਲਝਿਆ**: ਇਸ ਘਟਨਾ ਵਿੱਚ ਕੀ ਅਜੇ ਵੀ ਅਣਜਾਣਾ ਹੈ

ਸਟੀਕ ਅਤੇ ਹੈਰਾਨ ਕਰਨ ਵਾਲੇ ਵੇਰਵੇ ਦਿਓ। ਇਹ ਇੱਕ ਅਸਲ ਕਹਾਣੀ ਵਾਂਗੂ ਲੱਗਣੀ ਚਾਹੀਦੀ ਹੈ।`
      : `ਤੁਸੀਂ ਇੱਕ ਮਾਹਰ ਖੋਜਕਾਰ ਹੋ। ਵਿਸ਼ਾ: "${niche}" — ਕੋਣ: "${angle}"

ਇਸ ਵਿਸ਼ੇ 'ਤੇ ਡੂੰਘੀ ਖੋਜ ਕਰੋ ਅਤੇ ਦਿਓ:

1. **ਹੈਰਾਨ ਕਰਨ ਵਾਲੇ ਤੱਥ**: 5-7 ਅਜਿਹੇ ਤੱਥ ਜੋ ਜ਼ਿਆਦਾਤਰ ਲੋਕ ਨਹੀਂ ਜਾਣਦੇ — ਅੰਕੜੇ, ਸਬੂਤ
2. **ਵਿਗਿਆਨਕ/ਮਾਹਰ ਦ੍ਰਿਸ਼ਟੀਕੋਣ**: ਇਸ ਵਿਸ਼ੇ 'ਤੇ ਖੋਜ ਕੀ ਕਹਿੰਦੀ ਹੈ
3. **ਆਮ ਗਲਤਫਹਿਮੀਆਂ**: ਲੋਕ ਕੀ ਗਲਤ ਮੰਨਦੇ ਹਨ ਅਤੇ ਸੱਚ ਕੀ ਹੈ
4. **ਵਿਵਹਾਰਕ ਜਾਣਕਾਰੀ**: ਇਹ ਜਾਣਕਾਰੀ ਦਰਸ਼ਕਾਂ ਦੀ ਜ਼ਿੰਦਗੀ ਵਿੱਚ ਕਿਵੇਂ ਕੰਮ ਆਵੇਗੀ
5. **ਦਿਲਚਸਪ ਉਦਾਹਰਨਾਂ**: ਅਸਲ ਦੁਨੀਆ ਦੀਆਂ ਉਦਾਹਰਨਾਂ ਜੋ ਇਨ੍ਹਾਂ ਤੱਥਾਂ ਨੂੰ ਸਾਬਿਤ ਕਰਦੀਆਂ ਹਨ

ਸਟੀਕ ਅੰਕੜੇ ਅਤੇ ਤੱਥ ਦਿਓ।`
    : isHindi
    ? isStory
      ? `आप एक गहन खोजी पत्रकार हैं। विषय: "${niche}" — कोण: "${angle}"

महत्वपूर्ण नियम:
- आपको एक विशेष, असली, दस्तावेज़ी घटना चुननी होगी — जो वास्तव में हुई हो और सत्यापन योग्य हो
- सटीक स्थान (शहर, देश), सटीक वर्ष/तारीख, और शामिल लोगों के असली नाम दें
- कोई भी विवरण गढ़ें या मनगढ़ंत न करें — केवल वे तथ्य इस्तेमाल करें जो सत्यापित हो सकें
- अस्पष्ट न हों — "भारत का कोई गाँव" स्वीकार्य नहीं। "कुलधरा गाँव, राजस्थान, 1825 में छोड़ा गया" स्वीकार्य है

दें:
1. **मुख्य घटना**: सबसे चौंकाने वाली असली घटना — असली नाम, तारीख, जगह के साथ
2. **विस्तृत विवरण**: क्या हुआ, कब हुआ, किसके साथ हुआ — हर ज़रूरी जानकारी
3. **गवाह/सबूत**: क्या सबूत मिले, किसने देखा, किसने रिपोर्ट किया
4. **जाँच/परिणाम**: अधिकारियों या विशेषज्ञों ने क्या पाया
5. **रहस्य/अनसुलझा**: इस घटना में क्या अभी भी अनजाना है

सटीक और चौंकाने वाले विवरण दें। यह एक असली कहानी की तरह होनी चाहिए।`
      : `आप एक विशेषज्ञ शोधकर्ता हैं। विषय: "${niche}" — कोण: "${angle}"

इस विषय पर गहरी रिसर्च करें और दें:

1. **चौंकाने वाले तथ्य**: 5-7 ऐसे तथ्य जो ज़्यादातर लोग नहीं जानते — संख्याएँ, आँकड़े, प्रमाण
2. **वैज्ञानिक/विशेषज्ञ दृष्टिकोण**: इस विषय पर शोध क्या कहता है
3. **आम गलतफहमियाँ**: लोग क्या गलत मानते हैं और सच क्या है
4. **व्यावहारिक जानकारी**: यह जानकारी दर्शकों की ज़िंदगी में कैसे काम आएगी
5. **दिलचस्प उदाहरण**: असली दुनिया के उदाहरण जो इन तथ्यों को साबित करते हैं

सटीक आँकड़े और तथ्य दें। अस्पष्ट बातें न लिखें।`
    : isStory
      ? `You are a deep investigative journalist. Topic: "${niche}" — Angle: "${angle}"

CRITICAL RULES:
- You MUST pick ONE specific, real, documented incident — a case that actually happened with verifiable records
- Include the EXACT location (city, country), EXACT year/date, and REAL names of people involved
- Do NOT invent or fabricate any details — only use facts that can be verified
- Do NOT be vague — "a village in India" is not acceptable. "Kuldhara village, Rajasthan, India, abandoned in 1825" IS acceptable

Provide:
1. **The specific incident**: Name the exact event, case, or location — with date, place, real people involved
2. **What happened step by step**: Chronological account with specific details — no vague summaries
3. **Evidence & witnesses**: Official reports, news coverage, police records, eyewitness names
4. **Investigation & outcome**: What authorities found, what conclusions were drawn
5. **What makes it unique**: The ONE detail that makes this case unlike any other

This briefing will be turned into a YouTube video. Make it gripping, specific, and 100% factual.`
      : `You are an expert researcher. Topic: "${niche}" — Angle: "${angle}"

Research this topic deeply and provide:

1. **Surprising facts**: 5-7 facts most people don't know — with real numbers, statistics, and sources
2. **Scientific/expert view**: What research and experts actually say about this
3. **Common myths vs reality**: What people get wrong and what the truth actually is
4. **Practical insight**: How this knowledge applies to real life
5. **Compelling examples**: Real-world examples that prove these facts

Be specific with numbers and data. No vague generalities — give concrete, citable details.`;

  return callClaude(prompt, 1500);
}

export async function generateVideoScript(
  niche: string,
  duration: number,
  style: string,
  language: string = "en",
  previousTitles: string[] = [],
  preResearch?: { research: string; angle: string; contentType?: ContentType }
): Promise<GeneratedScript> {
  const isHindi = language === "hi";
  const isPunjabi = language === "pa";
  const isStory = (preResearch?.contentType ?? "story") === "story";

  const storyAngles = isPunjabi ? STORY_ANGLES_PA : isHindi ? STORY_ANGLES_HI : STORY_ANGLES_EN;
  const factsAngles = isPunjabi ? FACTS_ANGLES_PA : isHindi ? FACTS_ANGLES_HI : FACTS_ANGLES_EN;
  const angle = preResearch?.angle ?? pickRandom(isStory ? storyAngles : factsAngles);

  const avoidSection = previousTitles.length > 0
    ? (isPunjabi
        ? `\nਇਨ੍ਹਾਂ ਵਿਸ਼ਿਆਂ ਤੋਂ ਬਿਲਕੁਲ ਵੱਖਰਾ ਕੰਟੈਂਟ ਬਣਾਓ:\n${previousTitles.map(t => `- ${t}`).join("\n")}`
        : isHindi
        ? `\nइन विषयों से बिल्कुल अलग कंटेंट बनाएं:\n${previousTitles.map(t => `- ${t}`).join("\n")}`
        : `\nThese topics are already covered — create something COMPLETELY DIFFERENT:\n${previousTitles.map(t => `- ${t}`).join("\n")}`)
    : "";

  const research = preResearch?.research
    ?? await researchTopic(niche, angle, language, preResearch?.contentType ?? "story");

  const segmentCount = Math.round(duration / 10);

  const prompt = isPunjabi
    ? `ਤੁਸੀਂ ਇੱਕ YouTube ਵੀਡੀਓ ਸਕ੍ਰਿਪਟ ਲੇਖਕ ਹੋ। ਹੇਠਾਂ ਦਿੱਤੀ ਖੋਜ ਦੇ ਆਧਾਰ 'ਤੇ ਸਕ੍ਰਿਪਟ ਲਿਖੋ।

**ਖੋਜ:**
${research}

**ਵੀਡੀਓ ਵੇਰਵਾ:**
- ਵਿਸ਼ਾ: "${niche}"
- ਕਿਸਮ: ${isStory ? "ਅਸਲ ਕਹਾਣੀ / ਘਟਨਾ" : "ਤੱਥ / ਜਾਣਕਾਰੀ"}
- ਕੋਣ: ${angle}
- ਮਿਆਦ: ${duration} ਸਕਿੰਟ (~${segmentCount} ਸੈਗਮੈਂਟ)
- ਵਿਜ਼ੂਅਲ ਸ਼ੈਲੀ: ${style}${avoidSection}

**ਸਕ੍ਰਿਪਟ ਨਿਯਮ:**
- ਖੋਜ ਦੇ ਅਸਲ ਨਾਮ, ਤਾਰੀਖ਼ਾਂ, ਜਗ੍ਹਾਵਾਂ ਅਤੇ ਅੰਕੜੇ ਸਿੱਧੇ ਵਰਤੋ
- ਦਰਸ਼ਕ ਨਾਲ ਸਿੱਧੀ ਗੱਲ ਕਰੋ — "ਤੁਸੀਂ", "ਸੋਚੋ", "ਕੀ ਤੁਸੀਂ ਜਾਣਦੇ ਹੋ?"
- ${isStory ? "ਕਹਾਣੀ ਨੂੰ ਨਾਟਕੀ ਅਤੇ ਰਹੱਸਮਈ ਬਣਾਓ — ਜਿਵੇਂ ਕੋਈ ਸੱਚੀ ਕਹਾਣੀ ਸੁਣਾ ਰਿਹਾ ਹੋਵੇ" : "ਹਰ ਤੱਥ ਨੂੰ ਦਿਲਚਸਪ ਅਤੇ ਹੈਰਾਨ ਕਰਨ ਵਾਲੇ ਤਰੀਕੇ ਨਾਲ ਪੇਸ਼ ਕਰੋ"}
- ਵਾਕ ਛੋਟੇ, ਪ੍ਰਭਾਵਸ਼ਾਲੀ ਅਤੇ ਬੋਲਚਾਲ ਦੇ ਹੋਣ
- ਹਰ ਸੈਗਮੈਂਟ ~10 ਸਕਿੰਟ ਦਾ ਬੋਲਿਆ ਜਾਣ ਵਾਲਾ ਕੰਟੈਂਟ
- "text" ਪੰਜਾਬੀ ਵਿੱਚ, "visualDescription" ਅੰਗਰੇਜ਼ੀ ਵਿੱਚ

ਕੇਵਲ ਇਸ JSON ਫਾਰਮੈਟ ਵਿੱਚ ਜਵਾਬ ਦਿਓ:
{
  "title": "YouTube ਸਿਰਲੇਖ (70 ਅੱਖਰਾਂ ਤੱਕ, ਉਤਸੁਕਤਾ ਜਗਾਉਣ ਵਾਲਾ, ਪੰਜਾਬੀ ਵਿੱਚ)",
  "description": "YouTube ਵੇਰਵਾ (2-3 ਵਾਕ, ਪੰਜਾਬੀ ਵਿੱਚ)",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "hashtags": ["#Hashtag1", "#Hashtag2", "#Hashtag3", "#Hashtag4", "#Hashtag5", "#Hashtag6", "#Hashtag7", "#Hashtag8"],
  "segments": [
    {
      "text": "ਦਰਸ਼ਕ ਨਾਲ ਸਿੱਧੀ ਗੱਲ — ਅਸਲ ਤੱਥਾਂ/ਘਟਨਾਵਾਂ 'ਤੇ ਆਧਾਰਿਤ (ਪੰਜਾਬੀ ਵਿੱਚ)",
      "visualDescription": "real footage to search in English — places, people, documents"
    }
  ]
}`
    : isHindi
    ? `आप एक YouTube वीडियो स्क्रिप्ट लेखक हैं। नीचे दी गई रिसर्च के आधार पर स्क्रिप्ट लिखें।

**रिसर्च:**
${research}

**वीडियो विवरण:**
- विषय: "${niche}"
- प्रकार: ${isStory ? "असली कहानी / घटना" : "तथ्य / जानकारी"}
- कोण: ${angle}
- अवधि: ${duration} सेकंड (~${segmentCount} सेगमेंट)
- विज़ुअल स्टाइल: ${style}${avoidSection}

**स्क्रिप्ट नियम:**
- रिसर्च के असली नाम, तारीख, जगह और आँकड़े सीधे उपयोग करें
- दर्शक से सीधे बात करें — "आप", "सोचिए", "क्या आप जानते हैं?"
- ${isStory ? "कहानी को नाटकीय और रहस्यमय बनाएं — जैसे कोई सच्ची कहानी सुना रहा हो" : "हर तथ्य को रोचक और हैरान करने वाले तरीके से पेश करें"}
- वाक्य छोटे, पंचदार और बोलचाल के हों
- प्रत्येक सेगमेंट ~10 सेकंड का बोला जाने वाला कंटेंट
- "text" हिंदी में, "visualDescription" अंग्रेजी में

केवल इस JSON फॉर्मेट में उत्तर दें:
{
  "title": "YouTube शीर्षक (70 अक्षर तक, जिज्ञासा जगाने वाला, हिंदी में)",
  "description": "YouTube विवरण (2-3 वाक्य, हिंदी में)",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "hashtags": ["#Hashtag1", "#Hashtag2", "#Hashtag3", "#Hashtag4", "#Hashtag5", "#Hashtag6", "#Hashtag7", "#Hashtag8"],
  "segments": [
    {
      "text": "दर्शक से सीधे बात — असली तथ्यों/घटनाओं पर आधारित (हिंदी में)",
      "visualDescription": "real footage to search in English — places, people, documents"
    }
  ]
}`
    : `You are a YouTube script writer. Write a script grounded in the research below.

**Research:**
${research}

**Video specs:**
- Topic: "${niche}"
- Type: ${isStory ? "Real story / true event" : "Facts / educational"}
- Angle: ${angle}
- Duration: ${duration} seconds (~${segmentCount} segments)
- Visual style: ${style}${avoidSection}

**Script rules:**
- USE the real names, dates, places, and statistics from the research — this is what makes it credible
- Speak DIRECTLY to the viewer: "you", "imagine this", "here's what really happened", "did you know"
- ${isStory
      ? "Narrate like a true story — build tension, suspense, and reveal details one by one. Hook them early."
      : "Present each fact with wow-factor — lead with the surprising number or claim, then explain it. Keep energy high."}
- Short punchy sentences. Natural spoken rhythm. Rhetorical questions. No robotic narration.
- Each segment = ~10 seconds of spoken content (aim for ${segmentCount} segments)
- visualDescription: real footage to search — locations, people, documents, demonstrations

Respond with ONLY valid JSON:
{
  "title": "YouTube title (max 70 chars, curiosity-driven)",
  "description": "YouTube description (2-3 sentences)",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "hashtags": ["#Hashtag1", "#Hashtag2", "#Hashtag3", "#Hashtag4", "#Hashtag5", "#Hashtag6", "#Hashtag7", "#Hashtag8"],
  "segments": [
    {
      "text": "narration spoken to viewer — grounded in real research",
      "visualDescription": "real footage in English — locations, people, evidence, demonstrations"
    }
  ]
}`;

  const scriptText = await callClaude(prompt, 8000);
  const jsonMatch = scriptText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in response");

  const parsed = JSON.parse(jsonMatch[0]) as Omit<GeneratedScript, "fullText">;
  const fullText = parsed.segments.map((s) => s.text).join(" ");

  return { ...parsed, fullText };
}

/**
 * Convert a user-supplied raw script into a GeneratedScript without calling any AI.
 * - Splits on blank lines (paragraphs) → each paragraph = one segment
 * - Uses the paragraph text as the visual search query (after trimming)
 * - Derives a title from the first line and builds minimal YouTube metadata
 */
/** Strip markdown formatting so TTS only gets plain speakable text */
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]*)\*\*/g, "$1")   // **bold**
    .replace(/\*([^*]*)\*/g, "$1")         // *italic*
    .replace(/_{1,2}([^_]*)_{1,2}/g, "$1") // _underline_
    .replace(/\[([^\]]*)\]/g, "$1")         // [brackets]
    .replace(/#{1,6}\s*/g, "")              // # headings
    .replace(/`[^`]*`/g, "")               // `code`
    .replace(/---+/g, "")                   // horizontal rules
    .replace(/\s{2,}/g, " ")               // collapse whitespace
    .trim();
}

export function buildScriptFromRaw(
  rawScript: string,
  niche: string
): GeneratedScript {
  const raw = rawScript.trim();

  // Split on one or more blank lines; fall back to splitting every ~150 chars
  let chunks = raw.split(/\n\s*\n/).map((c) => c.trim()).filter(Boolean);

  // Remove separator/header-only chunks (---, **[Section]**, pure markdown, etc.)
  chunks = chunks
    .map(stripMarkdown)
    .filter((c) => c.length > 10); // must have real content

  if (chunks.length < 2) {
    // No paragraph breaks — split every ~150 chars at a word boundary
    chunks = [];
    let remaining = raw;
    while (remaining.length > 0) {
      if (remaining.length <= 160) { chunks.push(remaining); break; }
      const cut = remaining.lastIndexOf(" ", 160);
      const idx = cut > 40 ? cut : 160;
      chunks.push(remaining.slice(0, idx).trim());
      remaining = remaining.slice(idx).trim();
    }
  }

  const segments: ScriptSegment[] = chunks.map((text) => ({
    text,
    visualDescription: text.split(" ").slice(0, 12).join(" "),
  }));

  // Derive a title from first ~70 chars of first paragraph
  const firstLine = chunks[0].split("\n")[0].trim();
  const title = firstLine.length <= 70 ? firstLine : firstLine.slice(0, 67) + "…";

  // Simple description from the second paragraph (or empty if not enough content)
  const description = chunks[1] ? chunks[1].slice(0, 200) : "";

  // Extract keyword-like words for tags (3+ chars, non-common)
  const stopWords = new Set(["the","and","for","that","with","this","from","have","will","are","was","its","not","but","they","you","your","our","we","an","a","is","it","in","of","to","be","at","as","by","on","or","so"]);
  const words = raw.toLowerCase().match(/[a-z\u0900-\u097f]{3,}/g) ?? [];
  const freq = new Map<string, number>();
  words.forEach((w) => { if (!stopWords.has(w)) freq.set(w, (freq.get(w) ?? 0) + 1); });
  const tags = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([w]) => w);

  const hashtags = [niche, ...tags.slice(0, 5)]
    .map((t) => `#${t.replace(/\s+/g, "")}`)
    .slice(0, 8);

  const fullText = segments.map((s) => s.text).join(" ");
  return { title, description, tags, hashtags, segments, fullText };
}
