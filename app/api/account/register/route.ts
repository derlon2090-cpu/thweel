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

async function hashPassword(password: string) {
  const salt = token().slice(0, 24);
  return `sha256:${salt}:${await sha256(`${salt}:${password}`)}`;
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

function fallback(email: string, fullName: string) {
  const now = new Date().toISOString();
  const user = publicUser({
    id: `fallback_${email.replace(/[^a-z0-9]/gi, "_").slice(0, 40) || "user"}`,
    email,
    fullName,
    xpBalance: WELCOME_XP,
    xpLevel: 1,
    totalXpUsed: 0,
    totalXpEarned: WELCOME_XP,
    createdAt: now,
    lastLoginAt: now,
  });
  return Response.json({ user, source: "fallback-account" }, { status: 201, headers: { "Set-Cookie": cookie("client_fallback") } });
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
  let fullName = "";
  try {
    const body = await request.json();
    fullName = String(body?.fullName || "").trim();
    email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");

    if (fullName.length < 2 || !email.includes("@") || password.length < 8) {
      return Response.json(
        { error: "VALIDATION_ERROR", message: "أدخل اسماً وبريداً وكلمة مرور لا تقل عن 8 أحرف." },
        { status: 400 },
      );
    }

    const url = databaseUrl();
    if (!url) return fallback(email, fullName);

    const { neon } = await import("@neondatabase/serverless");
    const { ensureAccountTables } = await import("@/src/server/account-edge-db");
    const sql = neon(url);
    await ensureAccountTables(sql);
    const now = new Date().toISOString();
    const existing = await sql`SELECT "id" FROM "Profile" WHERE "email" = ${email} LIMIT 1`;
    const passwordHash = await hashPassword(password);
    const userId = existing[0]?.id || id("profile");

    const rows = await sql`
      INSERT INTO "Profile" (
        "id", "email", "fullName", "passwordHash", "lastLoginAt",
        "xpBalance", "xpLevel", "totalXpUsed", "totalXpEarned", "createdAt", "updatedAt"
      )
      VALUES (
        ${userId}, ${email}, ${fullName}, ${passwordHash}, ${now},
        ${WELCOME_XP}, 1, 0, ${WELCOME_XP}, ${now}, ${now}
      )
      ON CONFLICT ("email") DO UPDATE SET
        "fullName" = EXCLUDED."fullName",
        "passwordHash" = EXCLUDED."passwordHash",
        "lastLoginAt" = EXCLUDED."lastLoginAt",
        "xpBalance" = GREATEST("Profile"."xpBalance", ${WELCOME_XP}),
        "totalXpEarned" = GREATEST("Profile"."totalXpEarned", ${WELCOME_XP}),
        "updatedAt" = EXCLUDED."updatedAt"
      RETURNING "id", "email", "fullName", "xpBalance", "xpLevel", "totalXpUsed", "totalXpEarned", "createdAt", "lastLoginAt"
    `;

    if (!existing[0]?.id) {
      await sql`
        INSERT INTO "XpTransaction" ("id", "userId", "type", "amount", "balanceAfter", "description", "createdAt")
        VALUES (${id("xp")}, ${rows[0].id}, 'WELCOME_BONUS', ${WELCOME_XP}, ${WELCOME_XP}, ${"رصيد ترحيبي مجاني عند إنشاء الحساب"}, ${now})
      `;
    }

    const createdUser = rows[0] as PublicUserShape;
    const sessionToken = await createSession(sql, createdUser.id);
    return Response.json({ user: publicUser(createdUser), source: "neon-account" }, { status: 201, headers: { "Set-Cookie": cookie(sessionToken) } });
  } catch (error) {
    console.error("[quillora] Edge account register failed; using fallback session.", error);
    if (email.includes("@")) return fallback(email, fullName || email.split("@")[0] || "Quillora");
    return Response.json({ error: "REGISTER_FAILED", message: "تعذر إنشاء الحساب الآن. تحقق من البيانات وحاول مرة أخرى." }, { status: 400 });
  }
}
