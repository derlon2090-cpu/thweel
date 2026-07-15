import { prisma } from "@/src/lib/db";
import { requireUser } from "@/src/server/auth/session";
import { apiError, json } from "@/src/server/http";
import { publicJob } from "@/src/server/serializers";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();
    const jobs = await prisma.humanizeJob.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return json({ jobs: jobs.map(publicJob) });
  } catch (error) {
    return apiError(error);
  }
}
