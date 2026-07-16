export const runtime = "nodejs";

export async function GET() {
  const databaseConfigured = Boolean(
    process.env.DATABASE_URL ||
      process.env.POSTGRES_PRISMA_URL ||
      process.env.POSTGRES_URL ||
      process.env.POSTGRES_URL_NON_POOLING ||
      process.env.DIRECT_URL,
  );
  return Response.json({
    ok: databaseConfigured,
    runtime: "nodejs",
    databaseConfigured,
    vercelEnv: process.env.VERCEL_ENV || null,
    message: databaseConfigured ? "DATABASE_URL ظاهر في Node runtime." : "DATABASE_URL غير ظاهر في Node runtime.",
  });
}
