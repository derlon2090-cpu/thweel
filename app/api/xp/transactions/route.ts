import { prisma } from "@/src/lib/db";
import { requireUser } from "@/src/server/auth/session";
import { apiError, json } from "@/src/server/http";
import { publicTransaction } from "@/src/server/serializers";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();
    const transactions = await prisma.xpTransaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return json({ transactions: transactions.map(publicTransaction) });
  } catch (error) {
    return apiError(error);
  }
}
