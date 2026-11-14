import { publicConfig } from "./public-config.mjs";
import { createClient } from "@supabase/supabase-js";
import { loadLocalEnv } from "./load-env.mjs";
await loadLocalEnv();
const config = publicConfig();
if (!config.supabaseUrl) {
  console.log("SETUP REQUIRED: set PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY in your local .env.");
  process.exitCode = 1;
} else {
  const db = createClient(config.supabaseUrl, config.supabaseKey, { auth: { persistSession: false } });
  for (const [name, query] of [["Public catalogue", db.from("categories").select("id").limit(1)], ["Latest launch settings", db.from("store_settings").select("checkout_enabled,policies_approved,max_open_reservations").single()]]) {
    const { data, error } = await query;
    if (error) {
      console.log(name + ": NOT READY \u2014 " + error.message);
      process.exitCode = 1;
    } else console.log(name + ": reachable" + (name.includes("settings") ? " \xB7 checkout " + (data.checkout_enabled ? "enabled" : "disabled") : ""));
  }
  console.log("This read-only check does not test authentication, payments, admin permissions or fulfilment.");
}
