export const runtime = "edge";

function databaseUrl() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DIRECT_URL ||
    ""
  ).trim();
}

export async function GET() {
  const url = databaseUrl();
  if (!url) {
    return Response.json({
      ok: false,
      runtime: "edge",
      databaseConfigured: false,
      connected: false,
      vercelEnv: process.env.VERCEL_ENV || null,
      message: "DATABASE_URL غير ظاهر داخل بيئة النشر الحالية لهذا الرابط.",
    });
  }

  try {
    const { neon } = await import("@neondatabase/serverless");
    const { ensureAccountTables } = await import("@/src/server/account-edge-db");
    const sql = neon(url);
    await ensureAccountTables(sql);
    const result = await sql`
      SELECT
        to_regclass('"Profile"') IS NOT NULL AS "profileReady",
        to_regclass('"UserSession"') IS NOT NULL AS "sessionReady",
        to_regclass('"XpTransaction"') IS NOT NULL AS "xpReady"
    `;
    return Response.json({
      ok: Boolean(result[0]?.profileReady && result[0]?.sessionReady && result[0]?.xpReady),
      runtime: "edge",
      databaseConfigured: true,
      connected: true,
      vercelEnv: process.env.VERCEL_ENV || null,
      tables: result[0],
      message: "Neon متصل والجداول الأساسية جاهزة.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر الاتصال بقاعدة البيانات.";
    return Response.json({
      ok: false,
      runtime: "edge",
      databaseConfigured: true,
      connected: false,
      vercelEnv: process.env.VERCEL_ENV || null,
      message,
    }, { status: 503 });
  }
}
