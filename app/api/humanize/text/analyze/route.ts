import { detectLanguage } from "@/src/lib/language";
import { calculateTextXpCost, countArabicAwareWords } from "@/src/lib/xp";
import { requireUser } from "@/src/server/auth/session";
import { apiError, json } from "@/src/server/http";
import { textHumanizeSchema } from "@/src/server/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = textHumanizeSchema.parse(await request.json());
    const detectedLanguage = detectLanguage(input.text);
    const wordCount = countArabicAwareWords(input.text);
    const xpCost = calculateTextXpCost(wordCount);
    const balanceAfter = user.xpBalance - xpCost;
    const canProceed = balanceAfter >= 0;

    return json({
      status: canProceed ? "awaiting_confirmation" : "insufficient_xp",
      detectedLanguage,
      wordCount,
      xpCost,
      currentBalance: user.xpBalance,
      balanceAfter,
      canProceed,
      missingXp: canProceed ? 0 : Math.abs(balanceAfter),
      message: canProceed
        ? "رصيدك يكفي لإتمام التحويل. أكّد للمتابعة."
        : `ليس لديك رصيد XP كافٍ. تحتاج إلى ${Math.abs(balanceAfter)} XP إضافية.`,
    });
  } catch (error) {
    return apiError(error);
  }
}
