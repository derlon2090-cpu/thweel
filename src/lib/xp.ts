export const WELCOME_XP = 50;
export const WORDS_PER_XP_BLOCK = 100;
export const XP_PER_TEXT_BLOCK = 3;
export const XP_PER_FILE_MB = 5;
export const MIN_XP_COST = 3;

export function countArabicAwareWords(text: string): number {
  const normalized = text
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

  if (!normalized) return 0;
  return normalized.split(/\s+/u).filter(Boolean).length;
}

export function calculateTextXpCost(wordCount: number): number {
  if (wordCount <= 0) return 0;
  return Math.max(MIN_XP_COST, Math.ceil(wordCount / WORDS_PER_XP_BLOCK) * XP_PER_TEXT_BLOCK);
}

export function calculateFileXpCost(wordCount: number): number {
  return calculateTextXpCost(wordCount);
}

export function calculateXpLevel(totalXpEarned: number): number {
  if (totalXpEarned < 500) return 1;
  if (totalXpEarned < 1500) return 2;
  if (totalXpEarned < 3000) return 3;
  if (totalXpEarned < 6000) return 4;
  return 5 + Math.floor((totalXpEarned - 6000) / 5000);
}

export const FILE_WORD_LIMITS_BY_PLAN = {
  free: 3000,
  starter: 10000,
  pro: 60000,
  business: 200000,
} as const;

export function getFileWordLimit(plan = "free") {
  if (plan === "business") return FILE_WORD_LIMITS_BY_PLAN.business;
  if (plan === "pro") return FILE_WORD_LIMITS_BY_PLAN.pro;
  if (plan === "starter") return FILE_WORD_LIMITS_BY_PLAN.starter;
  return FILE_WORD_LIMITS_BY_PLAN.free;
}

export function isLargeFile(wordCount: number) {
  return wordCount >= 10000;
}

export function splitTextIntoChunks(text: string, maxWords = 900) {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += maxWords) {
    chunks.push(words.slice(i, i + maxWords).join(" "));
  }
  return chunks;
}
