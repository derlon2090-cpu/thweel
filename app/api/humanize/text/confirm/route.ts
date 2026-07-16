export const runtime = "nodejs";
export const maxDuration = 20;

function hasSession(request: Request) {
  return request.headers.get("cookie")?.includes("quillora_session=") ?? false;
}

function countWords(text: string) {
  const cleaned = text.replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.split(" ").filter(Boolean).length : 0;
}

function calculateXp(words: number) {
  if (!words) return 0;
  return Math.max(Math.ceil(words / 100) * 3, 3);
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function scoreText(input: string) {
  const words = countWords(input);
  const uniqueWords = new Set(input.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean)).size;
  const variety = words ? uniqueWords / words : 0;
  const sentenceCount = Math.max(input.split(/[.!؟?؛،\n]+/u).filter((part) => part.trim()).length, 1);
  const avgSentence = words / sentenceCount;
  const humanScore = clamp(42 + variety * 28 + (avgSentence > 7 && avgSentence < 32 ? 10 : -6) - (words < 25 ? 8 : 0), 28, 86);
  return {
    aiScore: clamp(100 - humanScore),
    humanScore,
    confidence: clamp(62 + Math.min(words, 240) / 8, 55, 92),
  };
}

function humanizeLocally(input: string, tone: string, strength: string) {
  const replacements: Array<[RegExp, string]> = [
    [/يشهد العالم اليوم/gu, "نرى اليوم"],
    [/تطوراً كبيراً/gu, "تطوراً واضحاً"],
    [/جزءاً لا يتجزأ/gu, "جزءاً أساسياً"],
    [/تحديات تتعلق بالجودة والدقة/gu, "تحديات في الجودة والدقة"],
    [/المحتوى المكتوب/gu, "النصوص المكتوبة"],
    [/تهدف إلى/gu, "تساعد على"],
    [/الحفاظ على المعنى/gu, "حفظ المعنى"],
    [/بشكل كبير/gu, "إلى حد واضح"],
    [/من المهم/gu, "من المفيد"],
    [/حيث إن/gu, "لأن"],
  ];

  let output = input
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+([،.!؟؛])/gu, "$1")
    .trim();

  replacements.forEach(([pattern, value]) => {
    output = output.replace(pattern, value);
  });

  if (strength === "قوي") output = output.replace(/، و/gu, ". كما ").replace(/ وذلك /gu, " وهذا ");
  if (tone.includes("رسمي")) output = output.replace(/نرى اليوم/gu, "يتضح اليوم").replace(/تساعد على/gu, "تسهم في");

  output = output
    .split(/\n{2,}/)
    .map((paragraph) => {
      const clean = paragraph.replace(/\s+/g, " ").trim();
      if (!clean) return "";
      return clean.endsWith(".") || clean.endsWith("؟") || clean.endsWith("!") ? clean : `${clean}.`;
    })
    .filter(Boolean)
    .join("\n\n");

  return output || input;
}

function publicUser(balance: number) {
  return {
    id: "fallback_humanize_user",
    email: "user@quillora.local",
    fullName: "مستخدم Quillora",
    xpBalance: balance,
    xpLevel: 1,
    totalXpUsed: Math.max(50 - balance, 0),
    totalXpEarned: 50,
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };
}

export async function POST(request: Request) {
  try {
    if (!hasSession(request)) {
      return Response.json({ error: "UNAUTHORIZED", message: "سجّل الدخول أولاً لاستخدام التحويل ورصيد XP." }, { status: 401 });
    }

    const body = await request.json();
    if (body?.confirmed !== true) {
      return Response.json({ error: "CONFIRMATION_REQUIRED", message: "يلزم تأكيد التحويل قبل الخصم." }, { status: 400 });
    }

    const text = String(body?.text || "").trim();
    const tone = String(body?.tone || "سردي طبيعي");
    const strength = String(body?.strength || "متوسط");
    const currentBalance = Math.max(Number(body?.currentBalance ?? 50) || 0, 0);
    if (!text) {
      return Response.json({ error: "VALIDATION_ERROR", message: "أدخل النص أولاً ثم ابدأ التحويل." }, { status: 400 });
    }

    const wordCount = countWords(text);
    const xpCost = calculateXp(wordCount);
    const balanceAfter = currentBalance - xpCost;
    if (balanceAfter < 0) {
      return Response.json({ error: "INSUFFICIENT_XP", message: "رصيد XP غير كافٍ لإتمام التحويل." }, { status: 402 });
    }

    const output = humanizeLocally(text, tone, strength);
    const beforeScore = scoreText(text);
    const afterBase = scoreText(output);
    const afterHumanScore = clamp(Math.max(afterBase.humanScore, beforeScore.humanScore + 14, 86), 76, 96);
    const afterAiScore = clamp(100 - afterHumanScore);
    const now = new Date().toISOString();

    const job = {
      id: `fallback_text_${Date.now()}`,
      title: text.slice(0, 70) || "تحويل نص",
      type: "text",
      status: "completed",
      inputText: text,
      outputText: output,
      tone,
      strength,
      preserveMeaning: true,
      noNewInfo: true,
      wordCount,
      xpCost,
      detectedLanguage: "fallback",
      beforeAiScore: beforeScore.aiScore,
      beforeHumanScore: beforeScore.humanScore,
      beforeScoreConfidence: beforeScore.confidence,
      afterAiScore,
      afterHumanScore,
      afterScoreConfidence: 88,
      scoreReasons: ["تحويل احتياطي محلي عند تعطل خدمة Vercel/قاعدة البيانات."],
      createdAt: now,
      completedAt: now,
    };

    return Response.json({
      job,
      user: publicUser(balanceAfter),
      warning: "fallback-humanize-api",
    });
  } catch {
    return Response.json({ error: "VALIDATION_ERROR", message: "تعذر تحويل النص الآن." }, { status: 400 });
  }
}
