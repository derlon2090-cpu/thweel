const DATABASE_URL_KEYS = ["DATABASE_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL", "POSTGRES_URL_NON_POOLING", "DIRECT_URL"] as const;

export class MissingDatabaseUrlError extends Error {
  constructor() {
    super("No database URL is configured for Quillora.");
    this.name = "MissingDatabaseUrlError";
  }
}

export function resolveDatabaseUrl() {
  for (const key of DATABASE_URL_KEYS) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return "";
}

export function ensureDatabaseUrlEnv() {
  const databaseUrl = resolveDatabaseUrl();
  if (databaseUrl && !process.env.DATABASE_URL) {
    process.env.DATABASE_URL = databaseUrl;
  }
  return databaseUrl;
}
