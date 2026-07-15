import { prisma } from "@/src/lib/db";
import { evaluateHumanScore } from "@/src/lib/human-score";
import { detectLanguage } from "@/src/lib/language";
import { calculateTextXpCost, countArabicAwareWords } from "@/src/lib/xp";
import { humanizeText } from "@/src/server/ai";
import { requireUser } from "@/src/server/auth/session";
import { apiError, json } from "@/src/server/http";
import { publicJob, publicUser } from "@/src/server/serializers";
import { textHumanizeSchema } from "@/src/server/schemas";
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
      return json({ error: "CONFIRMATION_REQUIRED", message: "يلزم تأكيد التحويل قبل الخصم." }, { status: 400 });
    }
    const input = textHumanizeSchema.parse(body);
    const detectedLanguage = detectLanguage(input.text);
    const wordCount = countArabicAwareWords(input.text);
    xpCost = calculateTextXpCost(wordCount);
    const beforeScore = evaluateHumanScore(input.text, detectedLanguage);

    const job = await prisma.humanizeJob.create({
      data: {
        userId: user.id,
        type: "TEXT",
        status: "PROCESSING",
        title: input.text.slice(0, 70),
        inputText: input.text,
        tone: input.tone,
        strength: input.strength,
        preserveMeaning: input.preserveMeaning,
        noNewInfo: input.noNewInfo,
        wordCount,
        xpCost,
        detectedLanguage,
        beforeAiScore: beforeScore.aiScore,
        beforeHumanScore: beforeScore.humanScore,
        beforeScoreConfidence: beforeScore.confidence,
        progress: 20,
        progressMessage: "تم خصم XP وبدء التحويل",
        startedAt: new Date(),
      },
    });
    jobId = job.id;

    await reserveXp(user.id, xpCost, "TEXT_HUMANIZE", "تحويل نص إلى صياغة بشرية", job.id);
    const result = await humanizeText(input.text, input.tone, input.strength);
    const afterScore = evaluateHumanScore(result.output, detectedLanguage);

    const completed = await prisma.humanizeJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        outputText: result.output,
        provider: result.provider,
        afterAiScore: afterScore.aiScore,
        afterHumanScore: afterScore.humanScore,
        afterScoreConfidence: afterScore.confidence,
        scoreReasons: afterScore.reasons,
        progress: 100,
        progressMessage: "اكتمل التحويل",
        completedAt: new Date(),
      },
    });
    const updatedUser = await prisma.profile.findUniqueOrThrow({ where: { id: user.id } });

    return json({ job: publicJob(completed), user: publicUser(updatedUser) });
  } catch (error) {
    if (userId && jobId && xpCost > 0) {
      await prisma.humanizeJob.updateMany({
        where: { id: jobId, userId },
        data: { status: "FAILED", errorMessage: error instanceof Error ? error.message : "FAILED", progressMessage: "فشل التحويل" },
      });
      await refundXp(userId, xpCost, "استرجاع XP بعد فشل التحويل", jobId).catch(() => null);
    }
    if (error instanceof Error && error.name === "INSUFFICIENT_XP") {
      return json({ error: "INSUFFICIENT_XP", message: "رصيد XP غير كافٍ لإتمام التحويل." }, { status: 402 });
    }
    return apiError(error);
  }
}
