import test from "node:test";
import assert from "node:assert/strict";
import { publicConfig } from "../scripts/public-config.mjs";
const jwt = (role) => "header." + Buffer.from(JSON.stringify({ role })).toString("base64url") + ".signature";
test("public build rejects service secrets and unsafe URLs without echoing keys", () => {
  assert.throws(() => publicConfig({ PUBLIC_SUPABASE_URL: "https://example.supabase.co", PUBLIC_SUPABASE_ANON_KEY: jwt("service_role") }), /public anon/);
  assert.throws(() => publicConfig({ PUBLIC_SUPABASE_URL: "https://example.supabase.co", PUBLIC_SUPABASE_ANON_KEY: "sb_secret_test" }), /secret/);
  assert.throws(() => publicConfig({ PUBLIC_SUPABASE_URL: "http://external.example.com", PUBLIC_SUPABASE_ANON_KEY: jwt("anon") }), /HTTPS/);
  assert.equal(publicConfig({ PUBLIC_SUPABASE_URL: "https://example.supabase.co", PUBLIC_SUPABASE_ANON_KEY: jwt("anon") }).supabaseKey, jwt("anon"));
  assert.equal(publicConfig({}).supabaseUrl, "");
});
