import { MissingDatabaseUrlError } from "@/src/lib/database-url";
import { ZodError } from "zod";

const VALIDATION_FALLBACK = "\u062a\u062d\u0642\u0642 \u0645\u0646 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u0645\u062f\u062e\u0644\u0629.";
const DATABASE_UNAVAILABLE =
  "\u0642\u0627\u0639\u062f\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u063a\u064a\u0631 \u0645\u062a\u0635\u0644\u0629 \u062d\u0627\u0644\u064a\u0627\u064b. \u062a\u0623\u0643\u062f \u0645\u0646 \u0631\u0628\u0637 \u0642\u0627\u0639\u062f\u0629 \u0628\u064a\u0627\u0646\u0627\u062a Vercel Postgres \u0623\u0648 \u0625\u0636\u0627\u0641\u0629 DATABASE_URL \u062b\u0645 \u0623\u0639\u062f \u0627\u0644\u0646\u0634\u0631.";
const DATABASE_NOT_READY =
  "\u0642\u0627\u0639\u062f\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u063a\u064a\u0631 \u0645\u0647\u064a\u0623\u0629 \u0628\u0639\u062f. \u0623\u0639\u062f \u0646\u0634\u0631 \u0627\u0644\u0645\u0634\u0631\u0648\u0639 \u0644\u064a\u062a\u0645 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u062c\u062f\u0627\u0648\u0644 \u062a\u0644\u0642\u0627\u0626\u064a\u0627\u064b.";
const SERVER_ERROR =
  "\u062d\u062f\u062b \u062e\u0637\u0623 \u063a\u064a\u0631 \u0645\u062a\u0648\u0642\u0639. \u062d\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649 \u0628\u0639\u062f \u0642\u0644\u064a\u0644.";

export function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init);
}

function isPrismaInitializationError(error: unknown) {
  return error instanceof Error && error.name === "PrismaClientInitializationError";
}

function isPrismaKnownCode(error: unknown, codes: string[]) {
  return typeof error === "object" && error !== null && "code" in error && codes.includes(String(error.code));
}

export function apiError(error: unknown) {
  if (error instanceof Response) return error;
  console.error(error);

  if (error instanceof ZodError) {
    return json(
      {
        error: "VALIDATION_ERROR",
        message: error.issues[0]?.message || VALIDATION_FALLBACK,
      },
      { status: 400 },
    );
  }

  if (error instanceof MissingDatabaseUrlError || isPrismaInitializationError(error)) {
    return json(
      {
        error: "DATABASE_UNAVAILABLE",
        message: DATABASE_UNAVAILABLE,
      },
      { status: 503 },
    );
  }

  if (isPrismaKnownCode(error, ["P2021", "P2022", "P2024"])) {
    return json(
      {
        error: "DATABASE_NOT_READY",
        message: DATABASE_NOT_READY,
      },
      { status: 503 },
    );
  }

  return json(
    {
      error: "SERVER_ERROR",
      message: SERVER_ERROR,
    },
    { status: 500 },
  );
}
