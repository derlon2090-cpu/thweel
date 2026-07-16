import { ensureDatabaseUrlEnv } from "@/src/lib/database-url";
import { WELCOME_XP } from "@/src/lib/xp";
import { hashPassword } from "@/src/server/auth/password";
import { apiError, json } from "@/src/server/http";
import { publicUser } from "@/src/server/serializers";
import { registerSchema } from "@/src/server/schemas";

export const runtime = "nodejs";
const DATABASE_UNAVAILABLE =
  "\u0642\u0627\u0639\u062f\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u063a\u064a\u0631 \u0645\u062a\u0635\u0644\u0629 \u062d\u0627\u0644\u064a\u0627\u064b. \u062a\u0623\u0643\u062f \u0645\u0646 \u0631\u0628\u0637 \u0642\u0627\u0639\u062f\u0629 \u0628\u064a\u0627\u0646\u0627\u062a Vercel Postgres \u0623\u0648 \u0625\u0636\u0627\u0641\u0629 DATABASE_URL \u062b\u0645 \u0623\u0639\u062f \u0627\u0644\u0646\u0634\u0631.";

export async function POST(request: Request) {
  try {
    const input = registerSchema.parse(await request.json());
    if (!ensureDatabaseUrlEnv()) {
      return json({ error: "DATABASE_UNAVAILABLE", message: DATABASE_UNAVAILABLE }, { status: 503 });
    }
    const [{ prisma }, { createUserSession }] = await Promise.all([
      import("@/src/lib/db"),
      import("@/src/server/auth/session"),
    ]);
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
