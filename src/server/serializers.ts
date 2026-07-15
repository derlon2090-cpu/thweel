import type { HumanizeJob, Profile, XpTransaction } from "@/app/generated/prisma";

export function publicUser(user: Profile) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    xpBalance: user.xpBalance,
    xpLevel: user.xpLevel,
    totalXpUsed: user.totalXpUsed,
    totalXpEarned: user.totalXpEarned,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}

export function publicJob(job: HumanizeJob) {
  return {
    id: job.id,
    type: job.type.toLowerCase(),
    status: job.status.toLowerCase(),
    title: job.title,
    inputText: job.inputText,
    outputText: job.outputText,
    tone: job.tone,
    strength: job.strength,
    sourceFormat: job.sourceFormat,
    outputFormat: job.outputFormat,
    fileName: job.fileName,
    fileSize: job.fileSize,
    wordCount: job.wordCount,
    xpCost: job.xpCost,
    detectedLanguage: job.detectedLanguage,
    beforeAiScore: job.beforeAiScore,
    beforeHumanScore: job.beforeHumanScore,
    beforeScoreConfidence: job.beforeScoreConfidence,
    afterAiScore: job.afterAiScore,
    afterHumanScore: job.afterHumanScore,
    afterScoreConfidence: job.afterScoreConfidence,
    scoreReasons: job.scoreReasons,
    progress: job.progress,
    progressMessage: job.progressMessage,
    totalChunks: job.totalChunks,
    processedChunks: job.processedChunks,
    provider: job.provider,
    errorMessage: job.errorMessage,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
  };
}

export function publicTransaction(tx: XpTransaction) {
  return {
    id: tx.id,
    type: tx.type.toLowerCase(),
    amount: tx.amount,
    balanceAfter: tx.balanceAfter,
    description: tx.description,
    createdAt: tx.createdAt,
    jobId: tx.jobId,
  };
}
