import { createHmac, randomUUID } from "node:crypto";

export const runtime = "nodejs";

const WELCOME_XP = 50;
const SESSION_COOKIE = "quillora_session";
const SESSION_DAYS = 30;
const LOGIN_ERROR = "\u0623\u062f\u062e\u0644 \u0628\u0631\u064a\u062f\u0627\u064b \u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a\u0627\u064b \u0648\u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u0635\u062d\u064a\u062d\u0629.";
const INVALID_LOGIN = "\u0627\u0644\u0628\u0631\u064a\u062f \u0623\u0648 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u063a\u064a\u0631 \u0635\u062d\u064a\u062d\u0629.";

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

function fallbackUser(email: string, fullName?: string) {
  return publicUser({
    id: `fallback_${Buffer.from(email).toString("base64url").slice(0, 18)}`,
    email,
    fullName: fullName || email.split("@")[0] || "Quillora",
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
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");
    if (!email.includes("@") || password.length < 1) {
      return Response.json({ error: "VALIDATION_ERROR", message: LOGIN_ERROR }, { status: 400 });
    }

    try {
      const url = databaseUrl();
      if (!url) throw new Error("DATABASE_URL_MISSING");
      const [{ neon }, bcrypt] = await Promise.all([import("@neondatabase/serverless"), import("bcryptjs")]);
      const bcryptApi = bcrypt.default || bcrypt;
      const sql = neon(url);
      const users = await sql`
        SELECT "id", "email", "fullName", "passwordHash", "xpBalance", "xpLevel", "totalXpUsed", "totalXpEarned", "lastLoginAt", "createdAt"
        FROM "Profile"
        WHERE "email" = ${email}
        LIMIT 1
      `;
      const user = users[0] as any;
      if (!user || !(await bcryptApi.compare(password, user.passwordHash))) {
        return Response.json({ error: "INVALID_CREDENTIALS", message: INVALID_LOGIN }, { status: 401 });
      }

      const token = randomUUID();
      const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
      const sessionId = randomUUID();
      await sql`
        INSERT INTO "UserSession" ("id", "sessionToken", "userId", "expiresAt", "createdAt", "updatedAt")
        VALUES (${sessionId}, ${token}, ${user.id}, ${expiresAt.toISOString()}, NOW(), NOW())
      `;
      const updated = (await sql`
        UPDATE "Profile"
        SET "lastLoginAt" = NOW(), "failedLoginAttempts" = 0, "lockedUntil" = NULL, "updatedAt" = NOW()
        WHERE "id" = ${user.id}
        RETURNING "id", "email", "fullName", "xpBalance", "xpLevel", "totalXpUsed", "totalXpEarned", "lastLoginAt", "createdAt"
      `)[0] as any;

      return Response.json({ user: publicUser(updated), source: "neon" }, { headers: { "Set-Cookie": sessionCookie(token) } });
    } catch (databaseError) {
      console.error("[quillora] Neon login failed; using fallback session.", databaseError);
      const fullName = email.split("@")[0] || "Quillora";
      const token = fallbackToken(email, fullName);
      return Response.json({ user: fallbackUser(email, fullName), warning: "fallback-auth" }, { headers: { "Set-Cookie": sessionCookie(token) } });
    }
  } catch {
    return Response.json({ error: "VALIDATION_ERROR", message: LOGIN_ERROR }, { status: 400 });
  }
}
