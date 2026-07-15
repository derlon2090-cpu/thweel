import { prisma } from "@/src/lib/db";
import { verifyPassword } from "@/src/server/auth/password";
import { createUserSession } from "@/src/server/auth/session";
import { apiError, json } from "@/src/server/http";
import { publicUser } from "@/src/server/serializers";
import { loginSchema } from "@/src/server/schemas";

export const runtime = "nodejs";

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export async function POST(request: Request) {
  try {
    const input = loginSchema.parse(await request.json());
    const email = input.email.toLowerCase();
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
