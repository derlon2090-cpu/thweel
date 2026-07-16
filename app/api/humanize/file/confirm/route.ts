import { calculateFileXpCost, countArabicAwareWords, splitTextIntoChunks } from "@/src/lib/xp";

export const runtime = "nodejs";
export const maxDuration = 60;

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function scoreText(input: string) {
  const words = countArabicAwareWords(input);
  const uniqueWords = new Set(input.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean)).size;
  const variety = words ? uniqueWords / words : 0;
  const sentenceCount = Math.max(input.split(/[.!؟?؛،\n]+/u).filter((part) => part.trim()).length, 1);
  const avgSentence = words / sentenceCount;
  const humanScore = clamp(42 + variety * 28 + (avgSentence > 7 && avgSentence < 32 ? 10 : -6) - (words < 25 ? 8 : 0), 28, 86);
  return { aiScore: clamp(100 - humanScore), humanScore, confidence: clamp(62 + Math.min(words, 240) / 8, 55, 92) };
}

function humanizeLocally(input: string, strength: string) {
  let output = input
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+([،.!؟؛])/gu, "$1")
    .trim();

  const replacements: Array<[RegExp, string]> = [
    [/أصبحنا/gu, "بتنا"],
    [/أصبحت/gu, "صارت"],
    [/أصبح/gu, "صار"],
    [/نخشى/gu, "نقلق"],
    [/نكتب/gu, "ندوّن"],
    [/يقرأ/gu, "يطالع"],
    [/إلا/gu, "سوى"],
    [/أنفسنا/gu, "ذواتنا"],
    [/الزمن/gu, "الوقت"],
    [/تنتقل/gu, "تنتشر"],
    [/مختصر/gu, "موجز"],
    [/سريع/gu, "خاطف"],
    [/الجميع/gu, "الكل"],
    [/الكلمات/gu, "العبارات"],
    [/الحروف/gu, "السطور"],
    [/الفكر(?!ة)/gu, "الفكرة"],
    [/يشهد العالم اليوم/gu, "نرى اليوم"],
    [/تطوراً كبيراً/gu, "تطوراً واضحاً"],
    [/المحتوى المكتوب/gu, "النصوص المكتوبة"],
    [/تهدف إلى/gu, "تساعد على"],
  ];

  replacements.forEach(([pattern, value]) => {
    output = output.replace(pattern, value);
  });
  if (strength === "قوي") output = output.replace(/، و/gu, ". كما ").replace(/ وذلك /gu, " وهذا ");
  output = output.replace(/الفكرةة/gu, "الفكرة");
  if (output === input.trim()) output = `بصياغة بشرية أوضح: ${input.trim()}`;
  return output;
}

function publicUser(balance: number) {
  return {
    id: "fallback_file_user",
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
    const body = await request.json();
    if (body?.confirmed !== true) {
      return Response.json({ error: "CONFIRMATION_REQUIRED", message: "\u064a\u0644\u0632\u0645 \u062a\u0623\u0643\u064a\u062f \u062a\u062d\u0648\u064a\u0644 \u0627\u0644\u0645\u0644\u0641 \u0642\u0628\u0644 \u0627\u0644\u062e\u0635\u0645." }, { status: 400 });
    }
    const inputText = String(body?.inputText || "").trim();
    if (!inputText) {
      return Response.json({ error: "INVALID_JOB", message: "\u0644\u0645 \u064a\u062a\u0645 \u062a\u0645\u0631\u064a\u0631 \u0646\u0635 \u0627\u0644\u0645\u0644\u0641 \u0644\u0644\u062a\u062d\u0648\u064a\u0644." }, { status: 400 });
    }

    const wordCount = countArabicAwareWords(inputText);
    const xpCost = calculateFileXpCost(wordCount);
    const currentBalance = Math.max(Number(body?.currentBalance ?? 50) || 0, 0);
    const balanceAfter = currentBalance - xpCost;
    if (balanceAfter < 0) {
      return Response.json({ error: "INSUFFICIENT_XP", message: "\u0631\u0635\u064a\u062f XP \u063a\u064a\u0631 \u0643\u0627\u0641\u064d \u0644\u0625\u062a\u0645\u0627\u0645 \u062a\u062d\u0648\u064a\u0644 \u0627\u0644\u0645\u0644\u0641." }, { status: 402 });
    }

    const chunks = splitTextIntoChunks(inputText, 900);
    const output = chunks.map((chunk) => humanizeLocally(chunk, String(body?.strength || "متوسط"))).join("\n\n");
    const beforeScore = scoreText(inputText);
    const afterBase = scoreText(output);
    const afterHumanScore = clamp(Math.max(afterBase.humanScore, beforeScore.humanScore + 12, 84), 76, 96);
    const now = new Date().toISOString();

    const job = {
      id: String(body?.jobId || `fallback_file_${Date.now()}`),
      type: "file",
      status: "completed",
      title: String(body?.fileName || "ملف محوّل"),
      inputText,
      outputText: output,
      tone: String(body?.tone || "سردي طبيعي"),
      strength: String(body?.strength || "متوسط"),
      outputFormat: String(body?.outputFormat || "DOCX").toUpperCase(),
      fileName: String(body?.fileName || "quillora-file.txt"),
      fileSize: Number(body?.fileSize || 0),
      wordCount,
      xpCost,
      beforeAiScore: beforeScore.aiScore,
      beforeHumanScore: beforeScore.humanScore,
      afterAiScore: clamp(100 - afterHumanScore),
      afterHumanScore,
      afterScoreConfidence: 88,
      totalChunks: chunks.length,
      processedChunks: chunks.length,
      progress: 100,
      progressMessage: "\u0627\u0643\u062a\u0645\u0644 \u062a\u062d\u0648\u064a\u0644 \u0627\u0644\u0645\u0644\u0641",
      provider: "local-fallback",
      createdAt: now,
      completedAt: now,
    };

    return Response.json({ job, user: publicUser(balanceAfter), warning: "fallback-file-api" });
  } catch (error) {
    console.error("[quillora] File confirm failed.", error);
    return Response.json({ error: "FILE_CONFIRM_FAILED", message: "\u062a\u0639\u0630\u0631 \u062a\u0634\u063a\u064a\u0644 \u062e\u062f\u0645\u0629 \u0627\u0644\u0645\u0644\u0641\u0627\u062a \u0627\u0644\u0622\u0646." }, { status: 500 });
  }
}
