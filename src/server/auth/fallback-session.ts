import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { WELCOME_XP } from "@/src/lib/xp";

type FallbackPayload = {
  id: string;
  email: string;
  fullName: string;
  exp: number;
};

const FALLBACK_PREFIX = "fallback.";
const FALLBACK_DAYS = 30;
const SESSION_COOKIE = "quillora_session";

function secret() {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || "quillora-fallback-session";
}

function base64url(input: string) {
  return Buffer.from(input, "utf8").toString("base64url");
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function verifySignature(payload: string, signature: string) {
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function fallbackUser(payload: FallbackPayload) {
  return {
    id: payload.id,
    email: payload.email,
    fullName: payload.fullName,
    passwordHash: "",
    emailVerifiedAt: null,
    lastLoginAt: new Date(),
    failedLoginAttempts: 0,
    lockedUntil: null,
    xpBalance: WELCOME_XP,
    xpLevel: 1,
    totalXpUsed: 0,
    totalXpEarned: WELCOME_XP,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export async function createFallbackSession(email: string, fullName?: string) {
  const payload: FallbackPayload = {
    id: `fallback_${Buffer.from(email).toString("base64url").slice(0, 18)}`,
    email,
    fullName: fullName || email.split("@")[0] || "مستخدم Quillora",
    exp: Date.now() + FALLBACK_DAYS * 24 * 60 * 60 * 1000,
  };
  const encoded = base64url(JSON.stringify(payload));
  const token = `${FALLBACK_PREFIX}${encoded}.${sign(encoded)}`;
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(payload.exp),
  });
  return fallbackUser(payload);
}

export function readFallbackSession(token?: string) {
  if (!token?.startsWith(FALLBACK_PREFIX)) return null;
  const unsigned = token.slice(FALLBACK_PREFIX.length);
  const [encoded, signature] = unsigned.split(".");
  if (!encoded || !signature || !verifySignature(encoded, signature)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as FallbackPayload;
    if (!payload.email || payload.exp <= Date.now()) return null;
    return fallbackUser(payload);
  } catch {
    return null;
  }
}
