import { detectLanguage } from "@/src/lib/language";
import { calculateFileXpCost, countArabicAwareWords, getFileWordLimit, isLargeFile } from "@/src/lib/xp";
import { extractTextFromUpload, FileTextExtractionError } from "@/src/server/files";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "FILE_REQUIRED", message: "\u0627\u062e\u062a\u0631 \u0645\u0644\u0641\u0627\u064b \u0644\u0644\u062a\u062d\u0644\u064a\u0644." }, { status: 400 });
    }

    const outputFormat = String(form.get("outputFormat") ?? "DOCX").toUpperCase();
    const tone = String(form.get("tone") ?? "\u0633\u0631\u062f\u064a \u0637\u0628\u064a\u0639\u064a");
    const strength = String(form.get("strength") ?? "\u0645\u062a\u0648\u0633\u0637");
    const currentBalance = Math.max(Number(form.get("currentBalance") ?? 50) || 0, 0);
    const extractedText = (await extractTextFromUpload(file)).trim();
    const wordCount = countArabicAwareWords(extractedText);
    if (wordCount === 0) {
      return Response.json({
        error: "NO_EXTRACTABLE_TEXT",
        message: "\u0644\u0645 \u0646\u062a\u0645\u0643\u0646 \u0645\u0646 \u0627\u0633\u062a\u062e\u0631\u0627\u062c \u0646\u0635 \u0642\u0627\u0628\u0644 \u0644\u0644\u062a\u062d\u0648\u064a\u0644. \u0642\u062f \u064a\u0643\u0648\u0646 \u0627\u0644\u0645\u0644\u0641 PDF \u0645\u0635\u0648\u0631\u0627\u064b \u0648\u064a\u062d\u062a\u0627\u062c OCR.",
      }, { status: 422 });
    }

    const detectedLanguage = detectLanguage(extractedText);
    const xpCost = calculateFileXpCost(wordCount);
    const wordLimit = getFileWordLimit("free");
    const limitExceeded = wordCount > wordLimit;
    const balanceAfter = currentBalance - xpCost;
    const canProceed = !limitExceeded && balanceAfter >= 0;
    const now = new Date().toISOString();

    return Response.json({
      job: {
        id: `fallback_file_${Date.now()}`,
        type: "file",
        status: "awaiting_confirmation",
        title: file.name,
        inputText: extractedText.slice(0, 50000),
        tone,
        strength,
        outputFormat,
        fileName: file.name,
        fileSize: file.size,
        wordCount,
        xpCost,
        detectedLanguage,
        createdAt: now,
      },
      jobId: `fallback_file_${Date.now()}`,
      inputText: extractedText.slice(0, 50000),
      status: limitExceeded ? "plan_limit_exceeded" : canProceed ? "awaiting_confirmation" : "insufficient_xp",
      fileName: file.name,
      fileSizeMb: Number((file.size / 1024 / 1024).toFixed(2)),
      fileSize: file.size,
      outputFormat,
      detectedLanguage,
      wordCount,
      xpCost,
      currentBalance,
      balanceAfter,
      canProceed,
      missingXp: balanceAfter < 0 ? Math.abs(balanceAfter) : 0,
      largeFile: isLargeFile(wordCount),
      wordLimit,
      warning: "fallback-file-api",
      message: limitExceeded
        ? `\u0647\u0630\u0627 \u0627\u0644\u0645\u0644\u0641 \u064a\u062a\u062c\u0627\u0648\u0632 \u062d\u062f \u0627\u0644\u0628\u0627\u0642\u0629 \u0627\u0644\u0645\u062c\u0627\u0646\u064a\u0629: ${wordLimit} \u0643\u0644\u0645\u0629.`
        : canProceed
          ? "\u062a\u0645 \u062a\u062d\u0644\u064a\u0644 \u0627\u0644\u0645\u0644\u0641. \u0623\u0643\u0651\u062f \u0627\u0644\u062a\u062d\u0648\u064a\u0644 \u0644\u0644\u0645\u062a\u0627\u0628\u0639\u0629 \u0628\u062f\u0648\u0646 \u0623\u064a \u062e\u0635\u0645 \u0642\u0628\u0644 \u0627\u0644\u062a\u0623\u0643\u064a\u062f."
          : `\u0631\u0635\u064a\u062f XP \u063a\u064a\u0631 \u0643\u0627\u0641\u064d. \u062a\u062d\u062a\u0627\u062c \u0625\u0644\u0649 ${Math.abs(balanceAfter)} XP \u0625\u0636\u0627\u0641\u064a\u0629.`,
    });
  } catch (error) {
    console.error("[quillora] File analyze failed.", error);
    if (error instanceof FileTextExtractionError) {
      return Response.json({ error: error.code, message: error.message }, { status: error.status });
    }
    return Response.json({ error: "FILE_ANALYZE_FAILED", message: "\u062a\u0639\u0630\u0631 \u062a\u0634\u063a\u064a\u0644 \u062e\u062f\u0645\u0629 \u0627\u0644\u0645\u0644\u0641\u0627\u062a \u0627\u0644\u0622\u0646." }, { status: 500 });
  }
}
