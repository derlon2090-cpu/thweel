import { prisma } from "@/src/lib/db";
import { WELCOME_XP } from "@/src/lib/xp";
import { hashPassword } from "@/src/server/auth/password";
import { createUserSession } from "@/src/server/auth/session";
import { apiError, json } from "@/src/server/http";
import { publicUser } from "@/src/server/serializers";
import { registerSchema } from "@/src/server/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = registerSchema.parse(await request.json());
    const email = input.email.toLowerCase();
    const passwordHash = await hashPassword(input.password);

    const user = await prisma.$transaction(async (tx) => {
      const profile = await tx.profile.create({
        data: {
          email,
          fullName: input.fullName,
          passwordHash,
          xpBalance: WELCOME_XP,
          totalXpEarned: WELCOME_XP,
          xpLevel: 1,
        },
      });
      await tx.xpTransaction.create({
        data: {
          userId: profile.id,
          type: "WELCOME_BONUS",
          amount: WELCOME_XP,
          balanceAfter: WELCOME_XP,
          description: "رصيد ترحيبي عند إنشاء الحساب",
        },
      });
      return profile;
    });

    await createUserSession(user.id);
    return json({ user: publicUser(user) }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return json({ error: "EMAIL_EXISTS", message: "هذا البريد مسجل مسبقاً." }, { status: 409 });
    }
    return apiError(error);
  }
}
