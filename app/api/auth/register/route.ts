import { prisma } from "@/src/lib/db";
import { WELCOME_XP } from "@/src/lib/xp";
import { createFallbackSession } from "@/src/server/auth/fallback-session";
import { hashPassword } from "@/src/server/auth/password";
import { createUserSession } from "@/src/server/auth/session";
import { publicUser } from "@/src/server/serializers";

export const runtime = "nodejs";

const REGISTER_ERROR =
  "\u0623\u062f\u062e\u0644 \u0627\u0633\u0645\u0627\u064b \u0648\u0628\u0631\u064a\u062f\u0627\u064b \u0648\u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u0644\u0627 \u062a\u0642\u0644 \u0639\u0646 8 \u0623\u062d\u0631\u0641.";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const fullName = String(body?.fullName || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");
    if (fullName.length < 2 || !email.includes("@") || password.length < 8) {
      return Response.json({ error: "VALIDATION_ERROR", message: REGISTER_ERROR }, { status: 400 });
    }

    try {
      const passwordHash = await hashPassword(password);
      const user = await prisma.profile.create({
        data: {
          email,
          fullName,
          passwordHash,
          xpBalance: WELCOME_XP,
          xpLevel: 1,
          totalXpEarned: WELCOME_XP,
          totalXpUsed: 0,
        },
      });

      await prisma.xpTransaction
        .create({
          data: {
            userId: user.id,
            type: "WELCOME_BONUS",
            amount: WELCOME_XP,
            balanceAfter: WELCOME_XP,
            description: "\u0631\u0635\u064a\u062f \u062a\u0631\u062d\u064a\u0628\u064a \u0645\u062c\u0627\u0646\u064a",
          },
        })
        .catch(() => null);

      await createUserSession(user.id);
      return Response.json({ user: publicUser(user), source: "neon" }, { status: 201 });
    } catch (databaseError: any) {
      if (databaseError?.code === "P2002") {
        return Response.json({ error: "EMAIL_EXISTS", message: "\u0647\u0630\u0627 \u0627\u0644\u0628\u0631\u064a\u062f \u0645\u0633\u062c\u0644 \u0645\u0633\u0628\u0642\u0627\u064b. \u0633\u062c\u0651\u0644 \u0627\u0644\u062f\u062e\u0648\u0644 \u0628\u062f\u0644\u0627\u064b \u0645\u0646 \u0625\u0646\u0634\u0627\u0621 \u062d\u0633\u0627\u0628 \u062c\u062f\u064a\u062f." }, { status: 409 });
      }
      console.error("[quillora] Neon register failed; using fallback session.", databaseError);
      const fallbackUser = await createFallbackSession(email, fullName);
      return Response.json({ user: publicUser(fallbackUser), warning: "fallback-auth" }, { status: 201 });
    }
  } catch {
    return Response.json({ error: "VALIDATION_ERROR", message: REGISTER_ERROR }, { status: 400 });
  }
}
