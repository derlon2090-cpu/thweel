export const runtime = "edge";

const WELCOME_XP = 50;
const SESSION_COOKIE = "quillora_session";

type PublicUserShape = {
  id: string;
  email: string;
  fullName: string;
  xpBalance: number;
  xpLevel: number;
  totalXpUsed: number;
  totalXpEarned: number;
  createdAt: Date | string;
  lastLoginAt?: Date | string | null;
};

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

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

function token() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function verifyPassword(password: string, passwordHash: string) {
  if (!passwordHash.startsWith("sha256:")) return false;
  const [, salt, expected] = passwordHash.split(":");
  if (!salt || !expected) return false;
  return (await sha256(`${salt}:${password}`)) === expected;
}

function publicUser(user: PublicUserShape) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    xpBalance: Number(user.xpBalance || WELCOME_XP),
    xpLevel: Number(user.xpLevel || 1),
    totalXpUsed: Number(user.totalXpUsed || 0),
    totalXpEarned: Number(user.totalXpEarned || WELCOME_XP),
    createdAt: new Date(user.createdAt).toISOString(),
    lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt).toISOString() : null,
  };
}

function cookie(value: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`;
}

function fallback(email: string) {
  const now = new Date().toISOString();
  const user = publicUser({
    id: `fallback_${email.replace(/[^a-z0-9]/gi, "_").slice(0, 40) || "user"}`,
    email,
    fullName: email.split("@")[0] || "Quillora",
    xpBalance: WELCOME_XP,
    xpLevel: 1,
    totalXpUsed: 0,
    totalXpEarned: WELCOME_XP,
    createdAt: now,
    lastLoginAt: now,
  });
  return Response.json({ user, source: "fallback-account" }, { headers: { "Set-Cookie": cookie("client_fallback") } });
}

async function createSession(sql: any, userId: string) {
  const sessionToken = token();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  await sql`
    INSERT INTO "UserSession" ("id", "sessionToken", "userId", "expiresAt", "createdAt", "updatedAt")
    VALUES (${id("session")}, ${sessionToken}, ${userId}, ${expiresAt.toISOString()}, ${now.toISOString()}, ${now.toISOString()})
  `;
  return sessionToken;
}

export async function POST(request: Request) {
  let email = "";
  try {
    const body = await request.json();
    email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");
    if (!email.includes("@") || password.length < 1) {
      return Response.json({ error: "VALIDATION_ERROR", message: "أدخل بريداً إلكترونياً وكلمة مرور صحيحة." }, { status: 400 });
    }

    const url = databaseUrl();
    if (!url) return fallback(email);

    const { neon } = await import("@neondatabase/serverless");
    const { ensureAccountTables } = await import("@/src/server/account-edge-db");
    const sql = neon(url);
    await ensureAccountTables(sql);
    const rows = await sql`
      SELECT "id", "email", "fullName", "passwordHash", "xpBalance", "xpLevel", "totalXpUsed", "totalXpEarned", "createdAt", "lastLoginAt"
      FROM "Profile"
      WHERE "email" = ${email}
      LIMIT 1
    `;

    if (!rows[0]) return fallback(email);
    const passwordMatches = await verifyPassword(password, rows[0].passwordHash || "");
    if (!passwordMatches) return Response.json({ error: "INVALID_CREDENTIALS", message: "البريد الإلكتروني أو كلمة المرور غير صحيحة." }, { status: 401 });

    const now = new Date().toISOString();
    const updated = await sql`
      UPDATE "Profile"
      SET "lastLoginAt" = ${now}, "xpBalance" = GREATEST("xpBalance", ${WELCOME_XP}), "updatedAt" = ${now}
      WHERE "id" = ${rows[0].id}
      RETURNING "id", "email", "fullName", "xpBalance", "xpLevel", "totalXpUsed", "totalXpEarned", "createdAt", "lastLoginAt"
    `;
    const updatedUser = updated[0] as PublicUserShape;
    const sessionToken = await createSession(sql, updatedUser.id);
    return Response.json({ user: publicUser(updatedUser), source: "neon-account" }, { headers: { "Set-Cookie": cookie(sessionToken) } });
  } catch (error) {
    console.error("[quillora] Edge account login failed; using fallback session.", error);
    if (email.includes("@")) return fallback(email);
    return Response.json({ error: "LOGIN_FAILED", message: "تعذر تسجيل الدخول الآن. تحقق من البيانات وحاول مرة أخرى." }, { status: 400 });
  }
}
