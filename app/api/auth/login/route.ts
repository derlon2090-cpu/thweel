import { ensureDatabaseUrlEnv } from "@/src/lib/database-url";
import { createFallbackSession } from "@/src/server/auth/fallback-session";
import { apiError, json } from "@/src/server/http";
import { loginSchema } from "@/src/server/schemas";

export const runtime = "nodejs";

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const DATABASE_UNAVAILABLE =
  "\u0642\u0627\u0639\u062f\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u063a\u064a\u0631 \u0645\u062a\u0635\u0644\u0629 \u062d\u0627\u0644\u064a\u0627\u064b. \u062a\u0623\u0643\u062f \u0645\u0646 \u0631\u0628\u0637 \u0642\u0627\u0639\u062f\u0629 \u0628\u064a\u0627\u0646\u0627\u062a Vercel Postgres \u0623\u0648 \u0625\u0636\u0627\u0641\u0629 DATABASE_URL \u062b\u0645 \u0623\u0639\u062f \u0627\u0644\u0646\u0634\u0631.";

export async function POST(request: Request) {
  try {
    const input = loginSchema.parse(await request.json());
    const email = input.email.toLowerCase();
    if (!ensureDatabaseUrlEnv()) {
      const user = await createFallbackSession(email);
      return json({ user, warning: DATABASE_UNAVAILABLE });
    }
    const [{ prisma }, { createUserSession }, { verifyPassword }, { publicUser }] = await Promise.all([
      import("@/src/lib/db"),
      import("@/src/server/auth/session"),
      import("@/src/server/auth/password"),
      import("@/src/server/serializers"),
    ]);
    const user = await prisma.profile.findUnique({ where: { email } });

    if (!user) {
      return json({ error: "INVALID_CREDENTIALS", message: "بيانات الدخول غير صحيحة." }, { status: 401 });
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return json({ error: "ACCOUNT_LOCKED", message: "الحساب مقفل مؤقتاً بسبب محاولات متكررة." }, { status: 423 });
    }

    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) {
      const attempts = user.failedLoginAttempts + 1;
      await prisma.profile.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: attempts,
          lockedUntil: attempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000) : null,
        },
      });
      return json({ error: "INVALID_CREDENTIALS", message: "بيانات الدخول غير صحيحة." }, { status: 401 });
    }

    const updated = await prisma.profile.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
    await createUserSession(updated.id);
    return json({ user: publicUser(updated) });
  } catch (error) {
    return apiError(error);
  }
}
