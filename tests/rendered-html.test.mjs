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
  assert.match(app, /\/api\/humanize\/text\/confirm/);
  assert.match(app, /\/api\/humanize\/file\/analyze/);
  assert.match(app, /\/api\/humanize\/file\/confirm/);
  assert.match(app, /\/api\/session\/login/);
  assert.match(app, /\/api\/session\/register/);
  assert.match(app, /\/login/);
  assert.match(app, /\/register/);
  assert.match(app, /clientFallbackUser/);
  assert.match(app, /quillora_session=client_fallback/);
  assert.match(app, /localHumanizeText/);
  assert.match(app, /تعذر الاتصال بخدمة التحويل السحابية/);
  assert.match(app, /completeLocalJob/);
});

test("auth deployment has database setup and clear server errors", async () => {
  const [databaseUrl, db, fallbackSession, prebuild, migration, vercel, http, css, layout, loginRoute, registerRoute, sessionLoginRoute, sessionRegisterRoute, textAnalyzeRoute, textConfirmRoute, fileAnalyzeRoute, fileConfirmRoute] = await Promise.all([
    readFile(new URL("../src/lib/database-url.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/db.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/server/auth/fallback-session.ts", import.meta.url), "utf8"),
    readFile(new URL("../scripts/prebuild.mjs", import.meta.url), "utf8"),
    readFile(new URL("../prisma/migrations/0001_init/migration.sql", import.meta.url), "utf8"),
    readFile(new URL("../vercel.json", import.meta.url), "utf8"),
    readFile(new URL("../src/server/http.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/login/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/register/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/session/login/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/session/register/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/humanize/text/analyze/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/humanize/text/confirm/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/humanize/file/analyze/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/humanize/file/confirm/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(databaseUrl, /POSTGRES_PRISMA_URL/);
  assert.match(databaseUrl, /POSTGRES_URL/);
  assert.match(databaseUrl, /MissingDatabaseUrlError/);
  assert.match(db, /await import\("@\/app\/generated\/prisma"\)/);
  assert.doesNotMatch(db, /import \{ PrismaClient \}/);
  assert.match(prebuild, /prisma/);
  assert.match(prebuild, /migrate/);
  assert.match(prebuild, /deploy/);
  assert.match(vercel, /prebuild\.mjs/);
  assert.match(migration, /CREATE TABLE "Profile"/);
  assert.match(migration, /CREATE TABLE "UserSession"/);
  assert.match(http, /ZodError/);
  assert.match(http, /MissingDatabaseUrlError/);
  assert.doesNotMatch(http, /from "@\/app\/generated\/prisma"/);
  assert.match(http, /VALIDATION_ERROR/);
  assert.match(http, /DATABASE_UNAVAILABLE/);
  assert.match(loginRoute, /source: "safe-auth"/);
  assert.match(registerRoute, /source: "safe-auth"/);
  assert.match(sessionLoginRoute, /safe-session/);
  assert.match(sessionRegisterRoute, /safe-session/);
  assert.doesNotMatch(textAnalyzeRoute, /@\/src\//);
  assert.doesNotMatch(textConfirmRoute, /@\/src\//);
  assert.doesNotMatch(fileAnalyzeRoute, /@\/src\/lib\/db/);
  assert.doesNotMatch(fileConfirmRoute, /@\/src\/lib\/db/);
  assert.match(loginRoute, /fallback-auth/);
  assert.match(registerRoute, /fallback-auth/);
  assert.match(textAnalyzeRoute, /fallback-humanize-api/);
  assert.match(textConfirmRoute, /fallback-humanize-api/);
  assert.match(loginRoute, /fallback-auth/);
  assert.match(registerRoute, /fallback-auth/);
  assert.match(fileAnalyzeRoute, /fallback-file-api/);
  assert.match(fileConfirmRoute, /fallback-file-api/);
  assert.match(fallbackSession, /fallback\./);
  assert.match(fallbackSession, /WELCOME_XP/);
  assert.doesNotMatch(layout, /next\/font\/google/);
  assert.doesNotMatch(css, /\.auth-card h1[\s\S]{0,120}font-size:\s*48px/);
  assert.doesNotMatch(css, /textarea[\s\S]{0,160}font-size:\s*20px/);
});
