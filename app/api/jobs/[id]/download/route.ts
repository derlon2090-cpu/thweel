import { prisma } from "@/src/lib/db";
import { requireUser } from "@/src/server/auth/session";
import { outputBuffer } from "@/src/server/files";
import { apiError, json } from "@/src/server/http";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const job = await prisma.humanizeJob.findFirst({ where: { id, userId: user.id } });
    if (!job || job.status !== "COMPLETED" || !job.outputText) {
      return json({ error: "NOT_FOUND", message: "لا يوجد ملف جاهز للتحميل." }, { status: 404 });
    }

    const result = await outputBuffer(job.outputText, job.outputFormat || "txt");
    const fileName = encodeURIComponent(`quillora-${job.id}.${result.extension}`);
    return new Response(result.buffer, {
      headers: {
        "content-type": result.contentType,
        "content-disposition": `attachment; filename*=UTF-8''${fileName}`,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
