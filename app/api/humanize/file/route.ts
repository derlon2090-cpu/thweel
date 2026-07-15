import { json } from "@/src/server/http";

export const runtime = "nodejs";

export async function POST() {
  return json(
    {
      error: "CONFIRMATION_FLOW_REQUIRED",
      message: "استخدم /api/humanize/file/analyze أولاً ثم /api/humanize/file/confirm بعد موافقة المستخدم.",
    },
    { status: 400 },
  );
}
