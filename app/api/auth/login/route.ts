export const runtime = "nodejs";

const WELCOME_XP = 50;
const SESSION_COOKIE = "quillora_session";
const LOGIN_ERROR = "\u0623\u062f\u062e\u0644 \u0628\u0631\u064a\u062f\u0627\u064b \u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a\u0627\u064b \u0648\u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u0635\u062d\u064a\u062d\u0629.";

function safeId(email: string) {
  return `fallback_${email.replace(/[^a-z0-9]/gi, "_").slice(0, 40) || "user"}`;
}

function sessionCookie() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=client_fallback; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`;
}

function publicUser(email: string, fullName?: string) {
  return {
    id: safeId(email),
    email,
    fullName: fullName || email.split("@")[0] || "Quillora",
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

    return Response.json(
      { user: publicUser(email), warning: "fallback-auth", source: "safe-auth" },
      { headers: { "Set-Cookie": sessionCookie() } },
    );
  } catch {
    return Response.json({ error: "VALIDATION_ERROR", message: LOGIN_ERROR }, { status: 400 });
  }
}
