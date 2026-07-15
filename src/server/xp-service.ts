import { prisma } from "@/src/lib/db";
import { calculateXpLevel } from "@/src/lib/xp";
import type { XpTransactionType } from "@/app/generated/prisma";

export async function grantXp(userId: string, amount: number, type: XpTransactionType, description: string, jobId?: string) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.profile.update({
      where: { id: userId },
      data: {
        xpBalance: { increment: amount },
        totalXpEarned: { increment: amount },
      },
    });
    const xpLevel = calculateXpLevel(user.totalXpEarned);
    const updated = await tx.profile.update({ where: { id: userId }, data: { xpLevel } });
    await tx.xpTransaction.create({
      data: {
        userId,
        jobId,
        type,
        amount,
        balanceAfter: updated.xpBalance,
        description,
      },
    });
    return updated;
  });
}

export async function reserveXp(userId: string, amount: number, type: XpTransactionType, description: string, jobId?: string) {
  if (amount <= 0) return prisma.profile.findUniqueOrThrow({ where: { id: userId } });

  return prisma.$transaction(async (tx) => {
    const user = await tx.profile.findUnique({ where: { id: userId } });
    if (!user) throw new Error("USER_NOT_FOUND");
    if (user.xpBalance < amount) {
      const shortage = new Error("INSUFFICIENT_XP");
      shortage.name = "INSUFFICIENT_XP";
      throw shortage;
    }

    const updated = await tx.profile.update({
      where: { id: userId },
      data: {
        xpBalance: { decrement: amount },
        totalXpUsed: { increment: amount },
      },
    });
    await tx.xpTransaction.create({
      data: {
        userId,
        jobId,
        type,
        amount: -amount,
        balanceAfter: updated.xpBalance,
        description,
      },
    });
    return updated;
  });
}

export async function refundXp(userId: string, amount: number, description: string, jobId?: string) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.profile.update({
      where: { id: userId },
      data: {
        xpBalance: { increment: amount },
        totalXpUsed: { decrement: amount },
      },
    });
    await tx.xpTransaction.create({
      data: {
        userId,
        jobId,
        type: "REFUND",
        amount,
        balanceAfter: updated.xpBalance,
        description,
      },
    });
    return updated;
  });
}
