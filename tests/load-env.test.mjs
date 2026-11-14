import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep, basename } from "node:path";
import { loadLocalEnv } from "../scripts/load-env.mjs";
test("local environment overrides shared defaults and preserves supplied process values", async () => {
  const directory = await mkdtemp(join(tmpdir(), "store-env-"));
  try {
    await writeFile(join(directory, ".env"), "PUBLIC_SUPABASE_URL=https://shared.example\nPUBLIC_PAYPAL_CLIENT_ID=shared\n");
    await writeFile(join(directory, ".env.local"), "PUBLIC_SUPABASE_URL=https://local.example\nPUBLIC_SUPABASE_ANON_KEY=public-test\n");
    const env = { PUBLIC_PAYPAL_CLIENT_ID: "process-value" };
    await loadLocalEnv({ directory, env });
    assert.equal(env.PUBLIC_SUPABASE_URL, "https://local.example");
    assert.equal(env.PUBLIC_SUPABASE_ANON_KEY, "public-test");
    assert.equal(env.PUBLIC_PAYPAL_CLIENT_ID, "process-value");
  } finally {
    const target = resolve(directory);
    assert.ok(target.startsWith(resolve(tmpdir()) + sep) && basename(target).startsWith("store-env-"));
    await rm(target, { recursive: true });
  }
});
test(".env.local is explicitly excluded from Git", async () => {
  const { readFile } = await import("node:fs/promises");
  const ignore = await readFile(".gitignore", "utf8");
  assert.ok(ignore.split(/\r?\n/).includes(".env.local"));
});
