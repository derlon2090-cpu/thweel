import { spawnSync } from "node:child_process";

const databaseUrl =
  process.env.DATABASE_URL?.trim() ||
  process.env.POSTGRES_PRISMA_URL?.trim() ||
  process.env.POSTGRES_URL?.trim() ||
  process.env.POSTGRES_URL_NON_POOLING?.trim() ||
  process.env.DIRECT_URL?.trim();

if (!databaseUrl) {
  console.warn("[quillora] No database URL was found; skipping Prisma migrations for this build.");
  process.exit(0);
}

process.env.DATABASE_URL = databaseUrl;

const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
