import { createHmac } from "node:crypto";

export const runtime = "nodejs";

const WELCOME_XP = 50;
const SESSION_COOKIE = "quillora_session";
const FALLBACK_DAYS = 30;
const LOGIN_ERROR = "\u0623\u062f\u062e\u0644 \u0628\u0631\u064a\u062f\u0627\u064b \u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a\u0627\u064b \u0648\u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u0635\u062d\u064a\u062d\u0629.";

function secret() {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || "quillora-fallback-session";
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function cookieValue(email: string, fullName: string) {
  const payload = {
    id: `fallback_${Buffer.from(email).toString("base64url").slice(0, 18)}`,
    email,
    fullName,
    exp: Date.now() + FALLBACK_DAYS * 24 * 60 * 60 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `fallback.${encoded}.${sign(encoded)}`;
}

function sessionCookie(token: string) {
  const maxAge = FALLBACK_DAYS * 24 * 60 * 60;
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function publicUser(email: string, fullName: string) {
  return {
    id: `fallback_${Buffer.from(email).toString("base64url").slice(0, 18)}`,
    email,
    fullName,
    xpBalance: WELCOME_XP,
    xpLevel: 1,
    totalXpUsed: 0,
    totalXpEarned: WELCOME_XP,
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");
    if (!email.includes("@") || password.length < 1) {
      return Response.json({ error: "VALIDATION_ERROR", message: LOGIN_ERROR }, { status: 400 });
    }

    const fullName = email.split("@")[0] || "Quillora";
    const token = cookieValue(email, fullName);
    return Response.json(
      {
        user: publicUser(email, fullName),
        warning: "fallback-auth",
      },
      {
        headers: { "Set-Cookie": sessionCookie(token) },
      },
    );
  } catch {
    return Response.json({ error: "VALIDATION_ERROR", message: LOGIN_ERROR }, { status: 400 });
  }
}
