import { prisma } from "@/src/lib/db";
import { evaluateHumanScore } from "@/src/lib/human-score";
import { calculateFileXpCost, splitTextIntoChunks } from "@/src/lib/xp";
import { humanizeText } from "@/src/server/ai";
import { requireUser } from "@/src/server/auth/session";
import { apiError, json } from "@/src/server/http";
import { publicJob, publicUser } from "@/src/server/serializers";
import { refundXp, reserveXp } from "@/src/server/xp-service";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  let jobId: string | undefined;
  let xpCost = 0;
  let userId: string | undefined;

  try {
    const user = await requireUser();
    userId = user.id;
    const body = await request.json();
    if (body.confirmed !== true) {
      return json({ error: "CONFIRMATION_REQUIRED", message: "يلزم تأكيد تحويل الملف قبل الخصم." }, { status: 400 });
    }

    const job = await prisma.humanizeJob.findFirst({ where: { id: String(body.jobId), userId: user.id } });
    if (!job || job.status !== "AWAITING_CONFIRMATION" || !job.inputText) {
      return json({ error: "INVALID_JOB", message: "لم يتم العثور على تحليل ملف جاهز للتأكيد." }, { status: 404 });
    }

    jobId = job.id;
    xpCost = calculateFileXpCost(job.wordCount);
    const beforeScore = evaluateHumanScore(job.inputText, (job.detectedLanguage as any) || "unknown");
    await reserveXp(user.id, xpCost, "FILE_HUMANIZE", "تحويل ملف إلى صياغة بشرية", job.id);

    await prisma.humanizeJob.update({
      where: { id: job.id },
      data: {
        status: "PROCESSING",
        xpCost,
        beforeAiScore: beforeScore.aiScore,
        beforeHumanScore: beforeScore.humanScore,
        beforeScoreConfidence: beforeScore.confidence,
        progress: 25,
        progressMessage: "تم خصم XP وبدء معالجة الملف",
      },
    });

    const chunks = splitTextIntoChunks(job.inputText, 900);
    const outputParts: string[] = [];
    for (let index = 0; index < chunks.length; index += 1) {
      const result = await humanizeText(chunks[index], job.tone, job.strength, true);
      outputParts.push(result.output);
    }
    const output = outputParts.join("\n\n");
    const afterScore = evaluateHumanScore(output, (job.detectedLanguage as any) || "unknown");

    const completed = await prisma.humanizeJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        outputText: output,
        outputFormat: String(body.outputFormat || job.outputFormat || "docx").toUpperCase(),
        provider: "openai",
        afterAiScore: afterScore.aiScore,
        afterHumanScore: afterScore.humanScore,
        afterScoreConfidence: afterScore.confidence,
        scoreReasons: afterScore.reasons,
        totalChunks: chunks.length,
        processedChunks: chunks.length,
        progress: 100,
        progressMessage: "اكتمل تحويل الملف",
        completedAt: new Date(),
      },
    });
    const updatedUser = await prisma.profile.findUniqueOrThrow({ where: { id: user.id } });

    return json({ job: publicJob(completed), user: publicUser(updatedUser) });
  } catch (error) {
    if (userId && jobId && xpCost > 0) {
      await prisma.humanizeJob.updateMany({
        where: { id: jobId, userId },
        data: { status: "FAILED", errorMessage: error instanceof Error ? error.message : "FAILED", progressMessage: "فشل تحويل الملف" },
      });
      await refundXp(userId, xpCost, "استرجاع XP بعد فشل تحويل الملف", jobId).catch(() => null);
    }
    if (error instanceof Error && error.name === "INSUFFICIENT_XP") {
      return json({ error: "INSUFFICIENT_XP", message: "رصيد XP غير كافٍ لإتمام تحويل الملف." }, { status: 402 });
    }
    return apiError(error);
  }
}
