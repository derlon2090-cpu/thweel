import { getCurrentUser } from "@/src/server/auth/session";
import { apiError, json } from "@/src/server/http";
import { publicUser } from "@/src/server/serializers";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return json({ user: null }, { status: 401 });
    return json({ user: publicUser(user) });
  } catch (error) {
    return apiError(error);
  }
}
