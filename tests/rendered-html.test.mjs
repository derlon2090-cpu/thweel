import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("production pages are wired to the shared app", async () => {
  const [home, files, history, features, pricing, login, register, layout, packageJson] =
    await Promise.all([
      readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/files/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/history/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/features/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/pricing/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/login/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/register/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
      readFile(new URL("../package.json", import.meta.url), "utf8"),
    ]);

  for (const page of [home, files, history, features, pricing, login, register]) {
    assert.match(page, /HumanizeApp/);
  }

  assert.match(layout, /lang="ar"/);
  assert.match(layout, /dir="rtl"/);
  assert.match(layout, /QUILLORA/);
  assert.match(packageJson, /"build": "next build"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});

test("app shell includes Quillora branding and XP flow", async () => {
  const app = await readFile(new URL("../app/HumanizeApp.tsx", import.meta.url), "utf8");

  assert.match(app, /quillora-logo\.png/);
  assert.match(app, /xp/);
  assert.match(app, /reserveXp/);
  assert.doesNotMatch(app, /localStorage/);
  assert.match(app, /\/api\/humanize\/text\/analyze/);
  assert.match(app, /\/api\/humanize\/text\/confirm/);
  assert.match(app, /\/api\/humanize\/file\/analyze/);
  assert.match(app, /\/api\/humanize\/file\/confirm/);
  assert.match(app, /\/login/);
  assert.match(app, /\/register/);
});

test("auth deployment has database setup and clear server errors", async () => {
  const [databaseUrl, prebuild, migration, vercel, http, css, layout] = await Promise.all([
    readFile(new URL("../src/lib/database-url.ts", import.meta.url), "utf8"),
    readFile(new URL("../scripts/prebuild.mjs", import.meta.url), "utf8"),
    readFile(new URL("../prisma/migrations/0001_init/migration.sql", import.meta.url), "utf8"),
    readFile(new URL("../vercel.json", import.meta.url), "utf8"),
    readFile(new URL("../src/server/http.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(databaseUrl, /POSTGRES_PRISMA_URL/);
  assert.match(databaseUrl, /POSTGRES_URL/);
  assert.match(prebuild, /prisma/);
  assert.match(prebuild, /migrate/);
  assert.match(prebuild, /deploy/);
  assert.match(vercel, /prebuild\.mjs/);
  assert.match(migration, /CREATE TABLE "Profile"/);
  assert.match(migration, /CREATE TABLE "UserSession"/);
  assert.match(http, /ZodError/);
  assert.match(http, /VALIDATION_ERROR/);
  assert.match(http, /DATABASE_UNAVAILABLE/);
  assert.match(layout, /Tajawal/);
  assert.doesNotMatch(css, /\.auth-card h1[\s\S]{0,120}font-size:\s*48px/);
  assert.doesNotMatch(css, /textarea[\s\S]{0,160}font-size:\s*20px/);
});
