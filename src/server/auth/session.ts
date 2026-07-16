import { cookies, headers } from "next/headers";
import { randomBytes } from "node:crypto";
import { prisma } from "@/src/lib/db";
import { readFallbackSession } from "@/src/server/auth/fallback-session";

export const SESSION_COOKIE = "quillora_session";
const SESSION_DAYS = 30;

export function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function sessionExpiresAt() {
  return new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
}

export async function createUserSession(userId: string) {
  const token = createSessionToken();
  const headerList = await headers();
  const session = await prisma.userSession.create({
    data: {
      sessionToken: token,
      userId,
      expiresAt: sessionExpiresAt(),
      ipAddress: headerList.get("x-forwarded-for")?.split(",")[0]?.trim(),
      userAgent: headerList.get("user-agent"),
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: session.expiresAt,
  });

  return session;
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const fallbackUser = readFallbackSession(token);
  if (fallbackUser) return fallbackUser;

  const session = await prisma.userSession.findUnique({
    where: { sessionToken: token },
    include: { user: true },
  });

  if (!session || session.revokedAt || session.expiresAt <= new Date()) {
    return null;
  }

  return session.user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Response(JSON.stringify({ error: "UNAUTHORIZED", message: "يلزم تسجيل الدخول أولاً." }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  return user;
}

export async function clearCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.userSession.updateMany({
      where: { sessionToken: token, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  cookieStore.delete(SESSION_COOKIE);
}
