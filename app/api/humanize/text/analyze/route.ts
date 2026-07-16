export const runtime = "nodejs";

function countWords(text: string) {
  const cleaned = text.replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.split(" ").filter(Boolean).length : 0;
}

function calculateXp(words: number) {
  if (!words) return 0;
  return Math.max(Math.ceil(words / 100) * 3, 3);
}

function detectLanguage(text: string) {
  const arabic = (text.match(/[\u0600-\u06ff]/g) || []).length;
  const latin = (text.match(/[A-Za-z]/g) || []).length;
  if (arabic > 0 && latin > 0) return "mixed";
  if (arabic > 0) return "ar";
  if (latin > 0) return "en";
  return "unknown";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const text = String(body?.text || "").trim();
    const currentBalance = Math.max(Number(body?.currentBalance ?? 50) || 0, 0);
    if (!text) {
      return Response.json({ error: "VALIDATION_ERROR", message: "أدخل النص أولاً ثم ابدأ التحويل." }, { status: 400 });
    }

    const wordCount = countWords(text);
    const xpCost = calculateXp(wordCount);
    const balanceAfter = currentBalance - xpCost;
    const canProceed = balanceAfter >= 0;

    return Response.json({
      status: canProceed ? "awaiting_confirmation" : "insufficient_xp",
      detectedLanguage: detectLanguage(text),
      wordCount,
      xpCost,
      currentBalance,
      balanceAfter,
      canProceed,
      missingXp: canProceed ? 0 : Math.abs(balanceAfter),
      message: canProceed
        ? "رصيدك يكفي لإتمام التحويل. أكّد للمتابعة."
        : `ليس لديك رصيد XP كافٍ. تحتاج إلى ${Math.abs(balanceAfter)} XP إضافية.`,
      warning: "fallback-humanize-api",
    });
  } catch {
    return Response.json({ error: "VALIDATION_ERROR", message: "تعذر تحليل النص الآن." }, { status: 400 });
  }
}
