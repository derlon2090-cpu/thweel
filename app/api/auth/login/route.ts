import { prisma } from "@/src/lib/db";
import { createFallbackSession } from "@/src/server/auth/fallback-session";
import { createUserSession } from "@/src/server/auth/session";
import { verifyPassword } from "@/src/server/auth/password";
import { publicUser } from "@/src/server/serializers";

export const runtime = "nodejs";

const LOGIN_ERROR = "\u0623\u062f\u062e\u0644 \u0628\u0631\u064a\u062f\u0627\u064b \u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a\u0627\u064b \u0648\u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u0635\u062d\u064a\u062d\u0629.";
const INVALID_LOGIN = "\u0627\u0644\u0628\u0631\u064a\u062f \u0623\u0648 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u063a\u064a\u0631 \u0635\u062d\u064a\u062d\u0629.";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");
    if (!email.includes("@") || password.length < 1) {
      return Response.json({ error: "VALIDATION_ERROR", message: LOGIN_ERROR }, { status: 400 });
    }

    try {
      const user = await prisma.profile.findUnique({ where: { email } });
      if (!user || !(await verifyPassword(password, user.passwordHash))) {
        return Response.json({ error: "INVALID_CREDENTIALS", message: INVALID_LOGIN }, { status: 401 });
      }

      const updated = await prisma.profile.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null },
      });
      await createUserSession(updated.id);
      return Response.json({ user: publicUser(updated), source: "neon" });
    } catch (databaseError) {
      console.error("[quillora] Neon login failed; using fallback session.", databaseError);
      const fallbackUser = await createFallbackSession(email);
      return Response.json({ user: publicUser(fallbackUser), warning: "fallback-auth" });
    }
  } catch {
    return Response.json({ error: "VALIDATION_ERROR", message: LOGIN_ERROR }, { status: 400 });
  }
}
