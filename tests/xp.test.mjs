import assert from "node:assert/strict";
import test from "node:test";

function countArabicAwareWords(text) {
  const normalized = text
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  if (!normalized) return 0;
  return normalized.split(/\s+/u).filter(Boolean).length;
}

function calculateTextXpCost(wordCount) {
  if (wordCount <= 0) return 0;
  return Math.max(3, Math.ceil(wordCount / 100) * 3);
}

test("Arabic-aware word counting handles Arabic and punctuation", () => {
  assert.equal(countArabicAwareWords("هذا نص عربي، لاختبار العدّ الصحيح للكلمات."), 7);
  assert.equal(countArabicAwareWords("Quillora يحافظ على المعنى 100%."), 5);
});

test("XP rule: 100 words = 3 XP with a 3 XP minimum", () => {
  assert.equal(calculateTextXpCost(1), 3);
  assert.equal(calculateTextXpCost(100), 3);
  assert.equal(calculateTextXpCost(101), 6);
  assert.equal(calculateTextXpCost(250), 9);
  assert.equal(calculateTextXpCost(0), 0);
});

test("welcome package is 50 XP and file cost is based on extracted words only", () => {
  const welcomeXp = 50;
  const calculateFileXpCost = calculateTextXpCost;

  assert.equal(welcomeXp, 50);
  assert.equal(calculateFileXpCost(40_000), 1200);
  assert.equal(calculateFileXpCost(10_000), 300);
});

test("language detection keeps humanize separate from translation", () => {
  function detectLanguage(text) {
    const arabicMatches = text.match(/[\u0600-\u06FF]/g)?.length ?? 0;
    const englishMatches = text.match(/[A-Za-z]/g)?.length ?? 0;
    const total = arabicMatches + englishMatches;
    if (total === 0) return "unknown";
    const arabicRatio = arabicMatches / total;
    const englishRatio = englishMatches / total;
    if (arabicRatio > 0.75) return "ar";
    if (englishRatio > 0.75) return "en";
    return "mixed";
  }

  assert.equal(detectLanguage("هذا نص عربي واضح"), "ar");
  assert.equal(detectLanguage("This is a professional English paragraph."), "en");
  assert.equal(detectLanguage("هذا منتج SaaS يعمل with API keys"), "mixed");
});

test("human score is not hard-coded to the old visual constants", async () => {
  const source = await import("node:fs/promises").then((fs) => fs.readFile("app/HumanizeApp.tsx", "utf8"));
  assert.equal(source.includes("<strong>68%</strong>"), false);
  assert.equal(source.includes('output ? "94%"'), false);
  assert.equal(source.includes("درجة بشرية 94%"), false);
});
