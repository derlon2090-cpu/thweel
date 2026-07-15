import { json } from "@/src/server/http";

export const runtime = "nodejs";

export async function POST() {
  return json(
    {
      error: "CONFIRMATION_FLOW_REQUIRED",
      message: "استخدم /api/humanize/text/analyze أولاً ثم /api/humanize/text/confirm بعد موافقة المستخدم.",
    },
    { status: 400 },
  );
}
