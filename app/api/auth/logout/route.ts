import { clearCurrentSession } from "@/src/server/auth/session";
import { apiError, json } from "@/src/server/http";

export const runtime = "nodejs";

export async function POST() {
  try {
    await clearCurrentSession();
    return json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
