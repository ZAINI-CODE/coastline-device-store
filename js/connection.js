import { db, settings, unwrap } from "./api.js";
import { escapeHTML as e } from "./core.js";
async function connectionPage() {
  if (!db) return '<section class="wrap page"><h1>Connection check</h1><p>Supabase public settings have not been configured.</p></section>';
  const { data: { user }, error } = await db.auth.getUser();
  const signedIn = Boolean(user && !error);
  let flow = null;
  try {
    flow = JSON.parse(sessionStorage.getItem("google-auth-check") || "null");
  } catch {
  }
  const hasGoogle = Boolean(user?.identities?.some((i) => i.provider === "google"));
  const callbackVerified = Boolean(signedIn && hasGoogle && flow && new Date(user.last_sign_in_at).getTime() >= flow.startedAt - 5e3);
  const newUserVerified = Boolean(callbackVerified && new Date(user.created_at).getTime() >= flow.startedAt - 5e3);
  let previous = null;
  try {
    previous = JSON.parse(sessionStorage.getItem("session-persistence-check") || "null");
  } catch {
  }
  let message = signedIn ? "Signed-in identity verified by Supabase." : "No signed-in session. Sign in to test session persistence.";
  if (previous) {
    if (signedIn && previous.userId === user.id) message = "Session restored after reload and identity verified by Supabase.";
    else message = "The expected signed-in session was not restored. Sign in and repeat this check.";
  }
  return `<section class="wrap page prose"><span class="eyebrow">INTEGRATION DIAGNOSTICS</span><h1>Connection check</h1><div class="panel"><h2>Supabase connection</h2><p>Project: ${e(new URL(settings.supabaseUrl).host)}</p><p id="session-check-result" role="status">${e(message)}</p>${signedIn ? `<p>Signed in as ${e(user.email || "your account")}.</p><button class="button" id="reload-session-check">Reload & test persistence</button>` : '<a class="button" href="#/account">Email sign-in</a>'}<button id="google-auth-check">Test Google sign-in</button>${flow ? `<p>Google callback: ${callbackVerified ? "Sign-in verified against Supabase after this test began." : "Not verified yet."}</p><p>Account creation: ${newUserVerified ? "A newly created Supabase account was verified during this flow." : signedIn ? "Existing account or new-account creation not verified." : "Not verified yet."}</p>` : ""}<p id="oauth-check-error" role="alert"></p><p>No access token, refresh token or key is displayed by this page. This check does not verify database RLS or payments.</p></div></section>`;
}
function wireConnection() {
  document.querySelector("#google-auth-check")?.addEventListener("click", async () => {
    try {
      sessionStorage.removeItem("session-persistence-check");
      sessionStorage.setItem("google-auth-check", JSON.stringify({ startedAt: Date.now() }));
      await unwrap(db.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin + location.pathname + "#/connection" } }));
    } catch (error) {
      document.querySelector("#oauth-check-error").textContent = error.message;
    }
  });
  document.querySelector("#reload-session-check")?.addEventListener("click", async () => {
    const { data: { user }, error } = await db.auth.getUser();
    if (error || !user) {
      document.querySelector("#session-check-result").textContent = "Sign in before testing persistence.";
      return;
    }
    sessionStorage.setItem("session-persistence-check", JSON.stringify({ userId: user.id, startedAt: Date.now() }));
    location.reload();
  });
}
export {
  connectionPage,
  wireConnection
};
