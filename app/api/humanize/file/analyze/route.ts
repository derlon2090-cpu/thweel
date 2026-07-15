import { prisma } from "@/src/lib/db";
import { detectLanguage } from "@/src/lib/language";
import { calculateFileXpCost, countArabicAwareWords, getFileWordLimit, isLargeFile } from "@/src/lib/xp";
import { requireUser } from "@/src/server/auth/session";
import { extractTextFromUpload, saveUploadedFile } from "@/src/server/files";
import { apiError, json } from "@/src/server/http";
import { publicJob } from "@/src/server/serializers";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return json({ error: "FILE_REQUIRED", message: "اختر ملفاً للتحليل." }, { status: 400 });
    }

    const outputFormat = String(form.get("outputFormat") ?? "docx").toUpperCase();
    const tone = String(form.get("tone") ?? "سردي طبيعي");
    const strength = String(form.get("strength") ?? "متوسط");
    const extractedText = (await extractTextFromUpload(file)).trim();
    const wordCount = countArabicAwareWords(extractedText);
    if (wordCount === 0) {
      return json({
        error: "NO_EXTRACTABLE_TEXT",
        message: "لم نتمكن من استخراج نص قابل للتحويل. قد يكون الملف PDF مصوراً ويحتاج OCR.",
      }, { status: 422 });
    }

    const detectedLanguage = detectLanguage(extractedText);
    const xpCost = calculateFileXpCost(wordCount);
    const wordLimit = getFileWordLimit("free");
    const limitExceeded = wordCount > wordLimit;
    const balanceAfter = user.xpBalance - xpCost;
    const canProceed = !limitExceeded && balanceAfter >= 0;
    const storagePath = await saveUploadedFile(user.id, file);

    const job = await prisma.humanizeJob.create({
      data: {
        userId: user.id,
        type: "FILE",
        status: "AWAITING_CONFIRMATION",
        title: file.name,
        inputText: extractedText.slice(0, 50000),
        tone,
        strength,
        sourceFormat: file.name.split(".").pop()?.toUpperCase(),
        outputFormat,
        fileName: file.name,
        fileSize: file.size,
        wordCount,
        xpCost,
        detectedLanguage,
        progress: 10,
        progressMessage: "تم استخراج النص وحساب التكلفة",
        files: {
          create: {
            userId: user.id,
            kind: "INPUT",
            fileName: file.name,
            mimeType: file.type || "application/octet-stream",
            size: file.size,
            storagePath,
          },
        },
      },
    });

    return json({
      job: publicJob(job),
      jobId: job.id,
      status: limitExceeded ? "plan_limit_exceeded" : canProceed ? "awaiting_confirmation" : "insufficient_xp",
      fileName: file.name,
      fileSizeMb: Number((file.size / 1024 / 1024).toFixed(2)),
      detectedLanguage,
      wordCount,
      xpCost,
      currentBalance: user.xpBalance,
      balanceAfter,
      canProceed,
      missingXp: balanceAfter < 0 ? Math.abs(balanceAfter) : 0,
      largeFile: isLargeFile(wordCount),
      wordLimit,
      message: limitExceeded
        ? `هذا الملف يتجاوز حد الباقة المجانية: ${wordLimit} كلمة.`
        : canProceed
          ? "تم تحليل الملف. أكّد التحويل للمتابعة بدون أي خصم قبل التأكيد."
          : `رصيد XP غير كافٍ. تحتاج إلى ${Math.abs(balanceAfter)} XP إضافية.`,
    });
  } catch (error) {
    return apiError(error);
  }
}
