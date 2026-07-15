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
  assert.match(app, /localStorage/);
  assert.match(app, /\/login/);
  assert.match(app, /\/register/);
});
