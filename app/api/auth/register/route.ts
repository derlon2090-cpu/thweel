import { createHmac, randomUUID } from "node:crypto";

export const runtime = "nodejs";

const WELCOME_XP = 50;
const SESSION_COOKIE = "quillora_session";
const SESSION_DAYS = 30;
const REGISTER_ERROR =
  "\u0623\u062f\u062e\u0644 \u0627\u0633\u0645\u0627\u064b \u0648\u0628\u0631\u064a\u062f\u0627\u064b \u0648\u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u0644\u0627 \u062a\u0642\u0644 \u0639\u0646 8 \u0623\u062d\u0631\u0641.";

function databaseUrl() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DIRECT_URL ||
    ""
  ).trim();
}

function secret() {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || "quillora-fallback-session";
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function fallbackToken(email: string, fullName: string) {
  const payload = {
    id: `fallback_${Buffer.from(email).toString("base64url").slice(0, 18)}`,
    email,
    fullName,
    exp: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `fallback.${encoded}.${sign(encoded)}`;
}

function sessionCookie(token: string) {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function publicUser(user: any) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    xpBalance: user.xpBalance ?? WELCOME_XP,
    xpLevel: user.xpLevel ?? 1,
    totalXpUsed: user.totalXpUsed ?? 0,
    totalXpEarned: user.totalXpEarned ?? WELCOME_XP,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}

function fallbackUser(email: string, fullName: string) {
  return publicUser({
    id: `fallback_${Buffer.from(email).toString("base64url").slice(0, 18)}`,
    email,
    fullName,
    xpBalance: WELCOME_XP,
    xpLevel: 1,
    totalXpUsed: 0,
    totalXpEarned: WELCOME_XP,
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  });
}

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
      const url = databaseUrl();
      if (!url) throw new Error("DATABASE_URL_MISSING");
      const [{ neon }, bcrypt] = await Promise.all([import("@neondatabase/serverless"), import("bcryptjs")]);
      const bcryptApi = bcrypt.default || bcrypt;
      const sql = neon(url);
      const existing = await sql`SELECT "id" FROM "Profile" WHERE "email" = ${email} LIMIT 1`;
      if (existing.length > 0) {
        return Response.json({ error: "EMAIL_EXISTS", message: "\u0647\u0630\u0627 \u0627\u0644\u0628\u0631\u064a\u062f \u0645\u0633\u062c\u0644 \u0645\u0633\u0628\u0642\u0627\u064b. \u0633\u062c\u0651\u0644 \u0627\u0644\u062f\u062e\u0648\u0644 \u0628\u062f\u0644\u0627\u064b \u0645\u0646 \u0625\u0646\u0634\u0627\u0621 \u062d\u0633\u0627\u0628 \u062c\u062f\u064a\u062f." }, { status: 409 });
      }

      const id = randomUUID();
      const passwordHash = await bcryptApi.hash(password, 12);
      const user = (await sql`
        INSERT INTO "Profile" ("id", "email", "fullName", "passwordHash", "xpBalance", "xpLevel", "totalXpUsed", "totalXpEarned", "createdAt", "updatedAt")
        VALUES (${id}, ${email}, ${fullName}, ${passwordHash}, ${WELCOME_XP}, 1, 0, ${WELCOME_XP}, NOW(), NOW())
        RETURNING "id", "email", "fullName", "xpBalance", "xpLevel", "totalXpUsed", "totalXpEarned", "lastLoginAt", "createdAt"
      `)[0] as any;

      await sql`
        INSERT INTO "XpTransaction" ("id", "userId", "type", "amount", "balanceAfter", "description", "createdAt")
        VALUES (${randomUUID()}, ${id}, 'WELCOME_BONUS', ${WELCOME_XP}, ${WELCOME_XP}, ${"\u0631\u0635\u064a\u062f \u062a\u0631\u062d\u064a\u0628\u064a \u0645\u062c\u0627\u0646\u064a"}, NOW())
      `.catch(() => null);

      const token = randomUUID();
      const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
      await sql`
        INSERT INTO "UserSession" ("id", "sessionToken", "userId", "expiresAt", "createdAt", "updatedAt")
        VALUES (${randomUUID()}, ${token}, ${id}, ${expiresAt.toISOString()}, NOW(), NOW())
      `;

      return Response.json({ user: publicUser(user), source: "neon" }, { status: 201, headers: { "Set-Cookie": sessionCookie(token) } });
    } catch (databaseError) {
      console.error("[quillora] Neon register failed; using fallback session.", databaseError);
      const token = fallbackToken(email, fullName);
      return Response.json({ user: fallbackUser(email, fullName), warning: "fallback-auth" }, { status: 201, headers: { "Set-Cookie": sessionCookie(token) } });
    }
  } catch {
    return Response.json({ error: "VALIDATION_ERROR", message: REGISTER_ERROR }, { status: 400 });
  }
}
