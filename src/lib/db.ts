import { PrismaClient } from "@/app/generated/prisma";
import { ensureDatabaseUrlEnv, MissingDatabaseUrlError } from "@/src/lib/database-url";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const databaseUrl = ensureDatabaseUrlEnv();

function missingDatabaseProxy() {
  return new Proxy(
    {},
    {
      get() {
        throw new MissingDatabaseUrlError();
      },
    },
  ) as PrismaClient;
}

export const prisma = databaseUrl
  ? (globalForPrisma.prisma ??
    new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    }))
  : missingDatabaseProxy();

if (databaseUrl && process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
