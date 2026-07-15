import { Prisma } from "@/app/generated/prisma";

export function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init);
}

export function apiError(error: unknown) {
  if (error instanceof Response) return error;
  console.error(error);

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return json(
      {
        error: "DATABASE_UNAVAILABLE",
        message: "قاعدة البيانات غير متصلة حالياً. تأكد من ربط قاعدة بيانات Vercel Postgres أو إضافة DATABASE_URL ثم أعد النشر.",
      },
      { status: 503 },
    );
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2021", "P2022", "P2024"].includes(error.code)) {
    return json(
      {
        error: "DATABASE_NOT_READY",
        message: "قاعدة البيانات غير مهيأة بعد. أعد نشر المشروع ليتم إنشاء الجداول تلقائياً.",
      },
      { status: 503 },
    );
  }

  return json(
    {
      error: "SERVER_ERROR",
      message: "حدث خطأ غير متوقع. حاول مرة أخرى بعد قليل.",
    },
    { status: 500 },
  );
}
