import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
test("Supabase SDK restores a stored session across client instances and clears it on sign out (mock server only)", async () => {
  const values = /* @__PURE__ */ new Map(), storage = { getItem: (key) => values.get(key) || null, setItem: (key, v) => values.set(key, v), removeItem: (key) => values.delete(key) };
  const user = { id: "11111111-1111-4111-8111-111111111111", aud: "authenticated", email: "test@example.invalid", app_metadata: {}, user_metadata: {}, created_at: (/* @__PURE__ */ new Date()).toISOString() };
  const now = Math.floor(Date.now() / 1e3), part = (v) => Buffer.from(JSON.stringify(v)).toString("base64url"), access = part({ alg: "HS256", typ: "JWT" }) + "." + part({ sub: user.id, iat: now, exp: now + 3600 }) + "." + Buffer.from("test-signature").toString("base64url");
  const options = { auth: { storage, storageKey: "isolated-session-test", persistSession: true, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: async (url) => String(url).includes("/logout") ? new Response(null, { status: 204 }) : new Response(JSON.stringify(user), { status: 200, headers: { "Content-Type": "application/json" } }) } };
  const first = createClient("https://example.supabase.co", "sb_publishable_local-test", options);
  const signed = await first.auth.setSession({ access_token: access, refresh_token: "mock-refresh-token" });
  assert.equal(signed.error, null);
  const second = createClient("https://example.supabase.co", "sb_publishable_local-test", options);
  const restored = await second.auth.getSession();
  assert.equal(restored.data.session?.user.id, user.id);
  assert.equal((await second.auth.getUser()).data.user.id, user.id);
  await second.auth.signOut({ scope: "local" });
  assert.equal((await second.auth.getSession()).data.session, null);
});
