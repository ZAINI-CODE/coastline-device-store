import {orderHistoryMarkup,wireOrderHistory} from './order-history.js';
import {profileOverview,profilePicture,wireProfile} from './profile.js';
import {phoneFields,wirePhone} from './checkout-phone.js';
import { db, unwrap, invoke } from "./api.js";
import { escapeHTML as e, money } from "./core.js";
import { safe, notify } from "./app.js";
import {resumeAfterSignIn,reviewAuthRedirect} from './review-navigation.js';
let user, currentProfile;
const field = (name, label, type = "text") => `<label>${label}<input name="${name}" type="${type}" required></label>`;
async function accountPage(authConfig={},catalogue=[]) {
  if (!db) return '<section class="wrap page"><h1>Your account</h1><div class="panel"><h2>We\u2019re getting ready.</h2><p>Account services are currently unavailable. Your cart stays on this device.</p><a class="button" href="#/shop">Explore the collection</a></div></section>';
  user = (await db.auth.getUser()).data.user;
  if(user&&resumeAfterSignIn())return '<section class="wrap page"><p>Returning to your page…</p></section>';
  if (!user) return `<section class="wrap page"><span class="eyebrow">WELCOME BACK</span><h1>Your connection to the store.</h1><div class="account-grid"><form id="login" class="panel"><h2>Sign in</h2>${field("email", "Email", "email")}${field("password", "Password", "password")}<button class="button">Sign in</button><button type="button" id="recover" class="text-button" aria-haspopup="dialog">Forgot password?</button><hr><button type="button" class="google-signin" data-provider="google"><svg class="google-icon" viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M44 24c0-1.3-.1-2.6-.4-4H24v8h11a10 10 0 0 1-4 6v5h7c4-4 6-9 6-15Z"/><path fill="#34A853" d="M24 44c6 0 10-2 14-5l-7-5c-2 1-4 2-7 2-5 0-10-4-11-9H6v6c4 7 10 11 18 11Z"/><path fill="#FBBC05" d="M13 27a12 12 0 0 1 0-7v-6H6a20 20 0 0 0 0 19Z"/><path fill="#EA4335" d="M24 12c3 0 6 1 8 3l6-6a20 20 0 0 0-32 5l7 6c1-5 6-8 11-8Z"/></svg>Continue with Google</button><button type="button" class="social-signin" data-provider="apple" aria-describedby="apple-provider-status" ${authConfig.appleEnabled?'':'disabled'}><svg class="apple-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.05 12.54c.03 3.21 2.82 4.28 2.85 4.3-.02.08-.45 1.52-1.48 3-0.9 1.3-1.84 2.6-3.32 2.63-1.45.03-1.92-.85-3.58-.85-1.66 0-2.18.82-3.55.88-1.43.05-2.51-1.42-3.42-2.72-1.87-2.7-3.3-7.62-1.39-10.94a5.3 5.3 0 0 1 4.48-2.72c1.4-.03 2.73.95 3.58.95.85 0 2.44-1.17 4.11-1 .7.03 2.67.29 3.94 2.15-.1.06-2.35 1.37-2.32 4.32ZM14.32 4.35C15.08 3.43 15.6 2.15 15.46.88c-1.1.04-2.44.74-3.23 1.66-.71.81-1.33 2.11-1.16 3.36 1.23.1 2.48-.63 3.25-1.55Z"/></svg>Continue with Apple</button><p id="apple-provider-status" class="field-help" ${authConfig.appleEnabled?'hidden':''}>Apple sign-in is awaiting configuration.</p></form><form id="register" class="panel"><h2>Create an account</h2><p>Keep your orders and tracking in one place.</p>${field("display_name", "Full name")}${field("email", "Email", "email")}${phoneFields()}${field("password", "Password (at least 12 characters)", "password")}<button class="button">Create account</button><p>Check your email to verify your account before signing in.</p></form></div></section>`;
  let accountRows;
  try {
    await unwrap(db.rpc("sync_my_profile"));
    accountRows = await Promise.all([unwrap(db.from("orders").select("*,order_items(product_id,variant_id,product_name,variant,quantity,unit_price_cents),order_status_history(status,payment_status,created_at)").eq("user_id", user.id).order("created_at", { ascending: false })), unwrap(db.from("customer_addresses").select("*")), unwrap(db.from("profiles").select("*").eq("id", user.id).maybeSingle()), unwrap(db.rpc("my_product_reviews"))]);
  } catch (error) {
    return `<section class="wrap page"><h1>Your account</h1><div class="panel"><h2>Signed in</h2><p>${e(user.email)}</p><p>Your account details are temporarily unavailable. Try reloading this page.</p><button id="logout">Sign out</button></div></section>`;
  }
  const [orders, addresses, profile, reviews] = accountRows;
  currentProfile=profile;
  const picture=await profilePicture(db,profile,user);
  return `<section class="wrap page"><div class="section-head"><div><span class="eyebrow">YOUR ACCOUNT</span><h1>Welcome back.</h1><p>${e(user.email)}</p></div><button id="logout">Sign out</button></div>${profileOverview(profile,user,picture)}<details class="panel account-security"><summary>Account security</summary><form id="password">${field("password", "New password (12+ characters)", "password")}<button class="button">Change password</button><p>Use this form after following a password recovery link.</p></form></details>${orderHistoryMarkup(orders,catalogue)}<h2>Saved addresses</h2><div class="account-grid">${addresses.map((a) => `<article class="panel"><p>${e(a.full_name)}<br>${e(a.line1)}<br>${e(a.city)}, ${e(a.state)} ${e(a.postal_code)}<br>${e(a.country)}</p><button data-delete-address="${e(a.id)}">Delete address</button></article>`).join("")}<form id="address" class="panel"><h3>Add an address</h3>${[["full_name", "Full name"], ["line1", "Street address"], ["city", "City"], ["state", "State / region"], ["postal_code", "ZIP / postal code"], ["country", "Country code"]].map(([n, l]) => field(n, l)).join("")}<button type="submit" class="button">Save address</button></form></div><h2>Your reviews</h2>${reviews.map((r) => `<article class="review"><p>${r.rating}/5 \xB7 ${r.approved ? "Published" : "Awaiting moderation"}</p><p>${e(r.body)}</p><a href="#/product/${e(r.product_id)}">View product</a></article>`).join("") || "<p>No reviews submitted.</p>"}</section>`;
}
function wireAccount(render) {
  wireOrderHistory();
  const registration=document.querySelector("#register");if(registration)wirePhone(registration);
  wireProfile(db,user,currentProfile,render,notify);
  document.querySelector("[data-view-orders]")?.addEventListener("click",()=>document.querySelector("#order-history").scrollIntoView({block:"start",behavior:"auto"}));
  document.querySelector("#login")?.addEventListener("submit", (ev) => safe(async () => {
    ev.preventDefault();
    const f = Object.fromEntries(new FormData(ev.target));
    await unwrap(db.auth.signInWithPassword(f));
    if(!resumeAfterSignIn())render();
  }));
  document.querySelector("#register")?.addEventListener("submit", (ev) => safe(async () => {
    ev.preventDefault();
    const f = Object.fromEntries(new FormData(ev.target));
    if (f.password.length < 12) throw new Error("Use at least 12 characters.");
    const result=await unwrap(db.auth.signUp({ email:f.email, password:f.password, options: { emailRedirectTo: reviewAuthRedirect(), data:{display_name:f.display_name.trim(),phone:f.phone} } }));
    if(result.session&&resumeAfterSignIn())return;
    notify("Check your email for the verification link.");
  }));
  document.querySelector("#recover")?.addEventListener("click", () => safe(async () => {
    let dialog=document.querySelector('#recovery-dialog');
    if(!dialog){dialog=document.createElement('dialog');dialog.id='recovery-dialog';dialog.className='store-dialog recovery-dialog';dialog.setAttribute('aria-labelledby','recovery-title');dialog.innerHTML='<div class="dialog-top"><h2 id="recovery-title">Reset your password</h2><button type="button" class="dialog-close" aria-label="Close password recovery">×</button></div><p>Enter your account email. We’ll send a secure link to set a new password.</p><form id="recovery-form"><label>Email<input name="email" type="email" autocomplete="email" required></label><button class="button" type="submit">Send recovery link</button><p role="status" id="recovery-status"></p></form>';document.body.append(dialog);dialog.querySelector('.dialog-close').onclick=()=>dialog.close();
     dialog.querySelector('form').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget,button=form.querySelector('button'),status=form.querySelector('[role=status]');button.disabled=true;try{await unwrap(db.auth.resetPasswordForEmail(new FormData(form).get('email'),{redirectTo:location.origin+location.pathname+'#/account'}));status.textContent='If an account exists, a recovery email will be sent. Check your inbox for the secure link.';}catch{status.textContent='The recovery link could not be requested. Please try again.';}finally{button.disabled=false;}};
    }
    dialog.querySelector('[name=email]').value=document.querySelector('#login [name=email]').value;dialog.showModal();
  }));
  document.querySelectorAll("[data-provider]").forEach((b) => b.onclick = () => safe(async () => {
    const config = await fetch("./config/store.json").then((r) => r.json());
    if (!config[b.dataset.provider + "Enabled"]) throw new Error("This sign-in provider is awaiting configuration.");
    await unwrap(db.auth.signInWithOAuth({ provider: b.dataset.provider, options: { redirectTo: reviewAuthRedirect() } }));
  }));
  document.querySelector("#logout")?.addEventListener("click", () => safe(async () => {
    await unwrap(db.auth.signOut());
    render();
  }));
  document.querySelector("#password")?.addEventListener("submit", (ev) => safe(async () => {
    ev.preventDefault();
    const password = new FormData(ev.target).get("password");
    if (password.length < 12) throw new Error("Use at least 12 characters.");
    await unwrap(db.auth.updateUser({ password }));
    sessionStorage.removeItem('passwordRecovery');
    notify("Password updated.");
    ev.target.reset();
  }));
  document.querySelector("#address")?.addEventListener("submit", (ev) => safe(async () => {
    ev.preventDefault();
    await unwrap(db.from("customer_addresses").insert({ user_id: user.id, ...Object.fromEntries(new FormData(ev.target)) }));
    render();
  }));
  document.querySelectorAll("[data-delete-address]").forEach((b) => b.onclick = () => safe(async () => {
    await unwrap(db.from("customer_addresses").delete().eq("id", b.dataset.deleteAddress));
    render();
  }));
  document.querySelectorAll(".zelle-reference").forEach((f) => f.onsubmit = (ev) => safe(async () => {
    ev.preventDefault();
    await invoke("zelle_reference", { id: f.dataset.id, reference: new FormData(f).get("reference") });
    notify("Reference saved. Payment is still pending verification.");
  }));
}
export {
  accountPage,
  wireAccount
};
