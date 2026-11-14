import { loadLocalEnv } from "./load-env.mjs";
import { publicConfig } from "./public-config.mjs";
import { createClient } from "@supabase/supabase-js";
import { writeFile, mkdir } from "node:fs/promises";
await loadLocalEnv();
const config = publicConfig();
const db = createClient(config.supabaseUrl, config.supabaseKey, { auth: { persistSession: false, autoRefreshToken: false, flowType: "pkce" } });
const redirectTo = "http://localhost:4173/#/account";
const { data, error } = await db.auth.signInWithOAuth({ provider: "google", options: { redirectTo, skipBrowserRedirect: true } });
if (error) throw error;
const response = await fetch(data.url, { redirect: "manual", headers: { apikey: config.supabaseKey }, signal: AbortSignal.timeout(2e4) });
const location = response.headers.get("location"), destination = location ? new URL(location) : null;
let failure = null;
if (response.status >= 400) {
  try {
    const p = await response.json();
    failure = { code: p.code || p.error_code || null, message: p.msg || p.message || p.error_description || p.error || null };
  } catch {
    failure = { message: "Authorization request failed" };
  }
}
const callback = destination?.searchParams.get("redirect_uri");
let downstream = null;
if (destination?.hostname === "accounts.google.com") {
  const r = await fetch(destination.href, { redirect: "manual", signal: AbortSignal.timeout(2e4) });
  const next = r.headers.get("location");
  downstream = { status: r.status, nextOrigin: next ? new URL(next, destination).origin : null };
}
const report = { checkedAt: (/* @__PURE__ */ new Date()).toISOString(), projectHost: new URL(config.supabaseUrl).host, requestedAppRedirect: redirectTo, status: response.status, destinationOrigin: destination?.origin || null, callbackUrl: callback || null, usesPKCE: true, googleClientIdPresent: Boolean(destination?.searchParams.get("client_id")), error: failure, googleEndpoint: downstream, completedConsent: false, callbackExchanged: false, userCreationVerified: false, sessionPersistenceVerified: false };
await mkdir("docs/integration", { recursive: true });
await writeFile("docs/integration/google-latest.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
