import { countArabicAwareWords } from "@/src/lib/xp";
import type { DetectedLanguage } from "@/src/lib/language";

export type HumanScoreResult = {
  aiScore: number;
  humanScore: number;
  confidence: number;
  reasons: string[];
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function sentenceLengths(text: string) {
  return text
    .split(/[.!؟?。]+/u)
    .map((sentence) => countArabicAwareWords(sentence))
    .filter((count) => count > 0);
}

export function evaluateHumanScore(text: string, language: DetectedLanguage = "unknown"): HumanScoreResult {
  const wordCount = countArabicAwareWords(text);
  if (wordCount === 0) {
    return { aiScore: 0, humanScore: 0, confidence: 0, reasons: ["لا يوجد نص كافٍ للتقييم."] };
  }

  const lengths = sentenceLengths(text);
  const avgSentence = lengths.reduce((sum, value) => sum + value, 0) / Math.max(1, lengths.length);
  const uniqueWords = new Set(text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean));
  const lexicalVariety = uniqueWords.size / Math.max(1, wordCount);
  const repeatedConnectors = (text.match(/(بالإضافة إلى ذلك|ومن الجدير بالذكر|في الختام|moreover|furthermore|as an ai)/gi) ?? []).length;
  const punctuationDensity = (text.match(/[،,؛;:.!?؟]/g) ?? []).length / Math.max(1, wordCount);
  const sentenceVariance =
    lengths.length <= 1
      ? 0
      : lengths.reduce((sum, value) => sum + Math.abs(value - avgSentence), 0) / lengths.length;

  let humanScore = 55;
  humanScore += clamp(lexicalVariety * 45, 0, 22);
  humanScore += clamp(sentenceVariance * 1.4, 0, 16);
  humanScore += punctuationDensity > 0.035 && punctuationDensity < 0.18 ? 8 : -5;
  humanScore += avgSentence >= 8 && avgSentence <= 28 ? 8 : -8;
  humanScore -= repeatedConnectors * 7;
  humanScore -= wordCount < 25 ? 12 : 0;
  humanScore += language === "mixed" ? 2 : 0;

  const finalHuman = clamp(humanScore);
  const reasons = [
    `تنوع المفردات: ${Math.round(lexicalVariety * 100)}%`,
    `متوسط طول الجملة: ${Math.round(avgSentence)} كلمة`,
    `تباين الجمل: ${Math.round(sentenceVariance)}`,
  ];
  if (repeatedConnectors > 0) reasons.push("ظهرت عبارات انتقالية مكررة قد توحي بأسلوب آلي.");

  return {
    aiScore: clamp(100 - finalHuman),
    humanScore: finalHuman,
    confidence: clamp(wordCount < 50 ? 55 : wordCount < 150 ? 72 : 86),
    reasons,
  };
}
