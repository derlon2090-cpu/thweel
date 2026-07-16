import { createHmac } from "node:crypto";

export const runtime = "nodejs";

const WELCOME_XP = 50;
const SESSION_COOKIE = "quillora_session";
const FALLBACK_DAYS = 30;
const REGISTER_ERROR =
  "\u0623\u062f\u062e\u0644 \u0627\u0633\u0645\u0627\u064b \u0648\u0628\u0631\u064a\u062f\u0627\u064b \u0648\u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u0644\u0627 \u062a\u0642\u0644 \u0639\u0646 8 \u0623\u062d\u0631\u0641.";

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
    const fullName = String(body?.fullName || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");
    if (fullName.length < 2 || !email.includes("@") || password.length < 8) {
      return Response.json({ error: "VALIDATION_ERROR", message: REGISTER_ERROR }, { status: 400 });
    }

    const token = cookieValue(email, fullName);
    return Response.json(
      {
        user: publicUser(email, fullName),
        warning: "fallback-auth",
      },
      {
        status: 201,
        headers: { "Set-Cookie": sessionCookie(token) },
      },
    );
  } catch {
    return Response.json({ error: "VALIDATION_ERROR", message: REGISTER_ERROR }, { status: 400 });
  }
}
