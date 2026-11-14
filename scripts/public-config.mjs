const supplied = (value) => typeof value === "string" && value.trim() && !value.includes("PLACEHOLDER") ? value.trim() : "";
function publicConfig(env = process.env) {
  const supabaseUrl = supplied(env.PUBLIC_SUPABASE_URL), supabaseKey = supplied(env.PUBLIC_SUPABASE_ANON_KEY), paypalClientId = supplied(env.PUBLIC_PAYPAL_CLIENT_ID);
  if (supabaseKey) {
    if (supabaseKey.startsWith("sb_secret_")) throw new Error("A secret Supabase key must never be placed in PUBLIC_SUPABASE_ANON_KEY. Use a public anon or publishable key.");
    if (!supabaseKey.startsWith("sb_publishable_")) {
      let role;
      try {
        role = JSON.parse(Buffer.from(supabaseKey.split(".")[1], "base64url").toString()).role;
      } catch {
      }
      if (role !== "anon") throw new Error("PUBLIC_SUPABASE_ANON_KEY must be a public anon or publishable key. No key value has been printed.");
    }
  }
  if (supabaseUrl) {
    const url = new URL(supabaseUrl);
    if (url.username || url.password || url.search || url.hash || !["https:", "http:"].includes(url.protocol) || url.protocol === "http:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new Error("Use an HTTPS Supabase project URL, or a local development URL.");
  }
  if (Boolean(supabaseUrl) !== Boolean(supabaseKey)) throw new Error("Provide both public Supabase URL and public key.");
  // Configured builds use persistent data; the local review server explicitly
  // opts into photography-only review without activating accounts or payments.
  return { supabaseUrl, supabaseKey, paypalClientId, frontendReview: env.PUBLIC_FRONTEND_REVIEW==='true'||!supabaseUrl };
}
export {
  publicConfig
};
