export function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init);
}

export function apiError(error: unknown) {
  if (error instanceof Response) return error;
  console.error(error);
  return json(
    {
      error: "SERVER_ERROR",
      message: "حدث خطأ غير متوقع. حاول مرة أخرى بعد قليل.",
    },
    { status: 500 },
  );
}
