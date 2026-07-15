import { prisma } from "@/src/lib/db";
import { requireUser } from "@/src/server/auth/session";
import { apiError, json } from "@/src/server/http";
import { publicJob } from "@/src/server/serializers";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const job = await prisma.humanizeJob.findFirst({ where: { id, userId: user.id } });
    if (!job) return json({ error: "NOT_FOUND", message: "لم يتم العثور على العملية." }, { status: 404 });
    return json({ job: publicJob(job) });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    await prisma.humanizeJob.deleteMany({ where: { id, userId: user.id } });
    return json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
