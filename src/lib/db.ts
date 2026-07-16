import type { PrismaClient } from "@/app/generated/prisma";
import { ensureDatabaseUrlEnv, MissingDatabaseUrlError } from "@/src/lib/database-url";

const databaseUrl = ensureDatabaseUrlEnv();
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

async function getPrismaClient() {
  if (!databaseUrl) throw new MissingDatabaseUrlError();
  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  const { PrismaClient } = await import("@/app/generated/prisma");
  const client = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }

  return client;
}

function modelProxy(modelName: string) {
  return new Proxy(
    {},
    {
      get(_target, methodName) {
        if (typeof methodName !== "string") return undefined;
        return async (...args: unknown[]) => {
          const client = await getPrismaClient();
          return (client as any)[modelName][methodName](...args);
        };
      },
    },
  );
}

export const prisma = new Proxy(
  {},
  {
    get(_target, propertyName) {
      if (!databaseUrl) throw new MissingDatabaseUrlError();
      if (typeof propertyName !== "string") return undefined;

      if (propertyName.startsWith("$")) {
        return async (...args: unknown[]) => {
          const client = await getPrismaClient();
          return (client as any)[propertyName](...args);
        };
      }

      return modelProxy(propertyName);
    },
  },
) as PrismaClient;
