export type DetectedLanguage = "ar" | "en" | "mixed" | "unknown";

export function detectLanguage(text: string): DetectedLanguage {
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

export function getLanguageInstruction(language: DetectedLanguage) {
  if (language === "ar") {
    return "النص عربي. أعد الصياغة باللغة العربية فقط، ولا تترجم إلى الإنجليزية.";
  }
  if (language === "en") {
    return "The text is English. Rewrite it in natural professional English only. Do not translate it into Arabic.";
  }
  if (language === "mixed") {
    return "النص يحتوي على العربية والإنجليزية. حافظ على نفس توزيع اللغات، وأعد صياغة كل جزء بلغته الأصلية دون ترجمة تلقائية.";
  }
  return "Preserve the source language. Do not translate unless translation mode is explicitly enabled.";
}
