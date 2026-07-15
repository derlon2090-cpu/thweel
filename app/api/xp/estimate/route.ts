import { calculateTextXpCost, countArabicAwareWords } from "@/src/lib/xp";
import { apiError, json } from "@/src/server/http";
import { estimateSchema } from "@/src/server/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = estimateSchema.parse(await request.json());
    const words = countArabicAwareWords(input.text);
    return json({ words, xpCost: calculateTextXpCost(words) });
  } catch (error) {
    return apiError(error);
  }
}
