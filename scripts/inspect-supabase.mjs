import { loadLocalEnv } from "./load-env.mjs";
import { publicConfig } from "./public-config.mjs";
import { writeFile, mkdir } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
await loadLocalEnv();
const config = publicConfig();
const headers = { apikey: config.supabaseKey };
const report = { checkedAt: (/* @__PURE__ */ new Date()).toISOString(), projectHost: new URL(config.supabaseUrl).host, mode: "read-only; no account creation, migrations or database writes", checks: [] };
async function request(name, path, options = {}) {
  try {
    const response = await fetch(config.supabaseUrl + path, { headers, ...options, signal: AbortSignal.timeout(2e4) });
    let payload;
    try {
      payload = await response.json();
    } catch {
    }
    return { name, status: response.status, payload };
  } catch (error) {
    return { name, status: null, error: error.cause?.code || error.message };
  }
}
const [health, settings, openapi, session] = await Promise.all([request("auth_health", "/auth/v1/health"), request("auth_settings", "/auth/v1/settings"), request("database_metadata", "/rest/v1/"), request("unauthenticated_user", "/auth/v1/user")]);
for (const item of [health, session]) report.checks.push({ name: item.name, status: item.status, error: item.error || item.payload?.error_code || item.payload?.code || null });
report.auth = { status: settings.status, providers: settings.payload?.external || null, emailSignupDisabled: settings.payload?.disable_signup ?? null, emailConfirmationAutoconfirm: settings.payload?.mailer_autoconfirm ?? null, error: settings.error || settings.payload?.msg || null };
if (settings.payload?.external?.google) {
  try {
    const client = createClient(config.supabaseUrl, config.supabaseKey, { auth: { persistSession: false, autoRefreshToken: false, flowType: "pkce" } });
    const { data, error } = await client.auth.signInWithOAuth({ provider: "google", options: { redirectTo: "http://localhost:4173/#/account", skipBrowserRedirect: true } });
    if (error) throw error;
    const response = await fetch(data.url, { redirect: "manual", headers, signal: AbortSignal.timeout(2e4) });
    const target = response.headers.get("location");
    const destination = target ? new URL(target) : null;
    let failure = null;
    if (!response.ok && response.status >= 400) {
      try {
        const payload = await response.json();
        failure = { code: payload.code || payload.error_code || null, message: payload.msg || payload.message || payload.error_description || payload.error || null };
      } catch {
        failure = { message: "Authorization endpoint returned an error" };
      }
    }
    report.googleAuthorization = { status: response.status, destinationOrigin: destination?.origin || null, callbackOrigin: destination?.searchParams.get("redirect_uri") ? new URL(destination.searchParams.get("redirect_uri")).origin : null, completedSignIn: false, error: failure };
  } catch (error) {
    report.googleAuthorization = { status: null, error: error.cause?.code || error.message, completedSignIn: false };
  }
}
report.databaseMetadata = { status: openapi.status, error: openapi.error || openapi.payload?.message || null, tables: Object.keys(openapi.payload?.definitions || {}), rpcs: Object.keys(openapi.payload?.paths || {}).filter((p) => p.startsWith("/rpc/")).map((p) => p.slice(5)) };
const expected = ["profiles", "products", "product_variants", "categories", "inventory", "shipping_rules", "orders", "order_items", "payments", "order_status_history", "reviews", "promotions", "promotion_products", "customer_addresses", "admin_audit_logs", "carts", "store_settings", "refunds", "contact_messages", "review_reports", "admin_members", "webhook_events", "request_limits"];
report.tables = await Promise.all(expected.map(async (table) => {
  const r = await request(table, "/rest/v1/" + table + "?select=*&limit=0");
  return { table, status: r.status, code: r.payload?.code || null, message: r.error || r.payload?.message || null };
}));
report.rls = { verified: false, note: "Public key requests cannot inspect pg_class/pg_policies or prove cross-user isolation. Run the supplied read-only SQL audit in an authorized administrator session and test two authenticated customers." };
await mkdir("docs/integration", { recursive: true });
await writeFile("docs/integration/supabase-readonly.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
