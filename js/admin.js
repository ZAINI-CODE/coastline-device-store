import {catalogueImportPanel,wireCatalogueImport} from './admin-catalogue-import.js';
import { bulkImportPanel, wireBulkImport } from "./bulk-import.js";
import { db, unwrap, invoke } from "./api.js";
import { escapeHTML as e, money } from "./core.js";
import { safe, notify } from "./app.js";
import { resources, loadLookups, editorPanel, wireEditor } from "./admin-editor.js";
const pageSize = 20;
let activeRows = [], currentResource = "products", factorId;
const tabs = [["overview", "Overview"], ["orders", "Orders"], ["catalogue", "Catalogue & stock"], ["promotions", "Promotions"], ["shipping", "Shipping & tax"], ["reviews", "Reviews"], ["messages", "Messages"], ["inventory-history", "Inventory history"], ["audit", "Audit history"], ["settings", "Launch settings"]];
function params() {
  return new URLSearchParams(location.hash.split("?")[1] || "");
}
function link(tab, extras = {}) {
  return "#/admin?" + new URLSearchParams({ tab, ...extras });
}
function pager(count, page, tab, extras = {}) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  return `<nav class="pagination" aria-label="${e(tab)} pages"><span>${count} records \xB7 Page ${page + 1} of ${pages}</span>${page > 0 ? `<a class="text-link" href="${e(link(tab, { ...extras, page: page - 1 }))}">\u2190 Previous</a>` : ""}${(page + 1) * pageSize < count ? `<a class="text-link" href="${e(link(tab, { ...extras, page: page + 1 }))}">Next \u2192</a>` : ""}</nav>`;
}
async function pageQuery(query, page) {
  const { data, error, count } = await query.range(page * pageSize, (page + 1) * pageSize - 1);
  if (error) throw error;
  return { rows: data, count: count || 0 };
}
function metrics(data) {
  const labels = { orders: "All orders", pending_payments: "Pending / processing payments", paid_orders: "Paid orders", processing: "Processing orders", shipped: "Shipped orders", delivered: "Delivered orders", cancelled: "Cancelled orders", products: "Products", published_products: "Published products", available_units: "Available inventory units", pending_reviews: "Reviews awaiting moderation", open_messages: "Open customer messages", reconciliation_alerts: "Reconciliation alerts" };
  return `<div class="metrics">${Object.entries(labels).map(([key, label]) => `<div class="panel"><strong>${data[key] ?? 0}</strong><span>${label}</span></div>`).join("")}</div><div class="account-grid"><div class="panel"><h3>Captured order totals</h3><strong>${money(data.captured_cents)}</strong><p>Includes shipping and tax on verified captured orders.</p></div><div class="panel"><h3>Completed refunds</h3><strong>${money(data.refunded_cents)}</strong><p>Net captured order totals: ${money(data.captured_cents - data.refunded_cents)}. This is not an accounting profit calculation.</p></div></div>`;
}
function orderCard(o) {
  const history = (o.order_status_history || []).slice().sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  const timeline = history.map((entry) => `<li>${e(new Date(entry.created_at).toLocaleString())} · ${e(entry.status)} · Payment ${e(entry.payment_status)}</li>`).join("");
  const statusHistory = timeline ? `<h3>Status history</h3><ol>${timeline}</ol>` : "<p>No status changes recorded.</p>";
  return `<article class="panel"><details><summary><strong>Order ${e(o.id)}</strong> \xB7 ${money(o.total_cents)} \xB7 ${e(o.payment_status)}</summary><p>${e(new Date(o.created_at).toLocaleString())} \xB7 ${e(o.method)} \xB7 ${e(o.status)}</p><p>${e(o.shipping_address.full_name)}<br>${e(o.shipping_address.line1)} ${e(o.shipping_address.line2 || "")}<br>${e(o.shipping_address.city)}, ${e(o.shipping_address.state)} ${e(o.shipping_address.postal_code)} \xB7 ${e(o.shipping_address.country)}</p>${o.order_items.map((i) => `<p>${e(i.product_name)} \xB7 ${e(i.sku)} \xB7 ${e(i.variant)} \xB7 ${i.quantity} \xD7 ${money(i.unit_price_cents)} \xB7 Discount ${money(i.discount_cents)}</p>`).join("")}<div class="total-line">Subtotal ${money(o.subtotal_cents)} \xB7 Discount ${money(o.discount_cents)} \xB7 Shipping ${money(o.shipping_cents)} \xB7 Tax ${money(o.tax_cents)}</div><p>Customer reference: ${e(o.payments?.reference || "None")}</p>${o.payments?.zelle_submitted_at?`<p>Submitted: ${e(new Date(o.payments.zelle_submitted_at).toLocaleString())}</p>`:""}${o.payments?.zelle_evidence_path?`<button data-zelle-evidence="${e(o.id)}">View payment screenshot</button><div data-zelle-evidence-result="${e(o.id)}"></div>`:""}<p>Provider order: ${e(o.payments?.provider_order_id || "None")}<br>Capture: ${e(o.payments?.capture_id || "None")}</p>${o.tracking_number ? `<p>Tracking: ${e(o.carrier)} \xB7 ${e(o.tracking_number)}</p>` : ""}${statusHistory}<form class="admin-order" data-id="${e(o.id)}"><label>Action<select name="action"><option value="processing">Mark processing</option><option value="shipped">Mark shipped</option><option value="delivered">Mark delivered</option><option value="cancel">Cancel unpaid order</option><option value="verify_zelle">Verify actual Zelle receipt</option><option value="cancel_zelle">Cancel Zelle after bank/customer reconciliation</option><option value="refund">Full refund / reconcile refund</option></select></label><label>Bank receipt / refund reference or tracking number<input name="value" maxlength="200"></label><label>Carrier (when shipping)<input name="carrier" maxlength="100"></label><label class="check"><input type="checkbox" name="bank_checked"> For Zelle verification: I checked the actual bank receipt, exact amount, recipient and transaction identity. For cancellation: I checked with the bank and customer that no transfer is outstanding.</label><button class="button">Apply order action</button></form></details></article>`;
}
async function adminPage() {
  if (!db) return '<section class="wrap page"><h1>Owner dashboard</h1><p>The owner workspace is unavailable in this collection preview. Administrative actions are paused.</p><a class="button" href="#/shop">Review the collection</a></section>';
  const { data: { user } } = await db.auth.getUser();
  if (!user) return '<section class="wrap page"><h1>Owner dashboard</h1><p>Sign in with your provisioned owner account.</p><a class="button" href="#/account">Sign in</a></section>';
  if (!await unwrap(db.rpc("is_admin"))) return `<section class="wrap page"><h1>Owner access</h1><p>A provisioned administrator account and a verified authenticator code are required. Access is enforced by the database.</p><button id="enroll">Set up authenticator</button><div id="mfa-enroll"></div><form id="mfa" class="panel"><label>Authenticator code<input name="code" inputmode="numeric" pattern="[0-9]{6}" autocomplete="one-time-code" required></label><button class="button">Verify MFA</button></form></section>`;
  const p = params(), tab = tabs.some(([t]) => t === p.get("tab")) ? p.get("tab") : "overview", page = Math.max(0, Math.min(1e5, Number.parseInt(p.get("page") || "0", 10) || 0));
  let body = "";
  if (tab === "overview") body = metrics(await unwrap(db.rpc("admin_store_summary")));
  else if (["catalogue", "promotions", "shipping", "settings"].includes(tab)) {
    const allowed = tab === "catalogue" ? ["products", "product_variants", "inventory", "product_costs", "categories"] : tab === "promotions" ? ["promotions", "promotion_products"] : tab === "shipping" ? ["shipping_rules"] : ["store_settings"];
    currentResource = allowed.includes(p.get("resource")) ? p.get("resource") : allowed[0];
    await loadLookups();
    const key = resources[currentResource].key[0], { rows, count } = await pageQuery(db.from(currentResource).select("*", { count: "exact" }).order(key), page);
    activeRows = rows;
    body = `<div class="resource-tabs">${allowed.map((r) => `<a class="${r === currentResource ? "active" : ""}" href="${e(link(tab, { resource: r }))}">${e(resources[r].label)}</a>`).join("")}</div><div class="admin-editor-layout"><div class="panel"><h2>Saved records</h2>${rows.map((r, i) => `<button class="record-picker" data-record="${i}">${e(r.name || r.sku || r.variant_id || r.id || r.product_id)}${r.published ? " \xB7 Published" : ""}</button>`).join("") || "<p>No records yet.</p>"}${pager(count, page, tab, { resource: currentResource })}<button id="download-records">Export this page as JSON</button></div><div id="record-editor">${editorPanel(currentResource, tab === "settings" ? rows[0] || {} : {})}</div></div>${bulkImportPanel(currentResource)}${tab==='catalogue'?catalogueImportPanel():''}`;
  } else if (tab === "orders") {
    let q = db.from("orders").select("*,payments(*),order_items(*),order_status_history(created_at,status,payment_status)", { count: "exact" }).order("created_at", { ascending: false }).order("id");
    const status = p.get("status");
    if (["pending", "processing", "paid", "failed", "cancelled", "refunded", "partially_refunded"].includes(status)) q = q.eq("payment_status", status);
    const { rows, count } = await pageQuery(q, page);
    body = `<form id="order-filter" class="filters"><label>Payment status<select name="status"><option value="">All</option>${["pending", "processing", "paid", "failed", "cancelled", "refunded", "partially_refunded"].map((s) => `<option ${s === status ? "selected" : ""}>${s}</option>`).join("")}</select></label><button class="button">Filter orders</button></form>${rows.map(orderCard).join("") || '<div class="empty"><h2>No matching orders</h2></div>'}${pager(count, page, tab, { status: status || "" })}`;
  } else if (tab === "reviews") {
    const { rows, count } = await pageQuery(db.from("reviews").select("id,product_id,display_name,rating,title,body,approved,verified_purchase,created_at", { count: "exact" }).order("created_at", { ascending: false }).order("id"), page);
    body = rows.map((r) => `<article class="panel"><h3>${e(r.display_name)} \xB7 ${r.rating}/5</h3>${r.title ? `<p><strong>${e(r.title)}</strong></p>` : ''}<p>${e(r.body)}</p><p>Product: ${e(r.product_id)} \xB7 ${r.approved ? "Published" : "Unpublished"}</p><button data-review="${e(r.id)}" data-approved="true">Approve</button><button data-review="${e(r.id)}" data-approved="false">Unpublish / reject</button></article>`).join("") || "<p>No reviews.</p>";
    body += pager(count, page, tab);
  } else if (tab === "messages") {
    const { rows, count } = await pageQuery(db.from("contact_messages").select("*", { count: "exact" }).order("created_at", { ascending: false }).order("id"), page);
    body = rows.map((m) => `<article class="panel"><h2>${e(m.subject)}</h2><p>${e(m.message)}</p><p>Customer: ${e(m.user_id)} \xB7 ${e(new Date(m.created_at).toLocaleString())}</p><button data-message="${e(m.id)}" ${m.handled ? "disabled" : ""}>${m.handled ? "Handled" : "Mark handled"}</button></article>`).join("") || "<p>No messages.</p>";
    body += pager(count, page, tab);
  } else if (tab === "inventory-history") {
    const {rows,count}=await pageQuery(db.from('inventory_adjustments').select('*',{count:'exact'}).order('id',{ascending:false}),page);
    body=rows.map(r=>`<article class="panel"><p>${e(r.variant_id)} · ${r.before_quantity??0} → ${r.after_quantity} (${r.delta>0?'+':''}${r.delta})</p><p>${e(r.reason)} · ${r.provisional?'Provisional demo':'Physical stock'} · ${e(r.actor||'Trusted backend')} · ${e(r.created_at)}</p></article>`).join('')+pager(count,page,tab);
  } else if (tab === "audit") {
    const { rows, count } = await pageQuery(db.from("admin_audit_logs").select("*", { count: "exact" }).order("id", { ascending: false }), page);
    body = `<div class="audit-list">${rows.map((a) => `<p>${e(new Date(a.created_at).toLocaleString())} \xB7 ${e(a.action)} \xB7 ${e(a.record_id)} \xB7 ${e(a.actor || "Trusted backend")} \xB7 ${e(a.outcome)}</p>`).join("") || "<p>No audit entries.</p>"}</div>${pager(count, page, tab)}`;
  }
  return `<section class="wrap page owner-workspace"><span class="eyebrow">OWNER WORKSPACE</span><h1>Store management</h1><div class="admin-nav" aria-label="Owner sections">${tabs.map(([t, label]) => `<a class="${t === tab ? "active" : ""}" href="${e(link(t))}" ${t === tab ? 'aria-current="page"' : ""}>${label}</a>`).join("")}</div>${body}</section>`;
}
function wireAdmin(render) {
  document.querySelector("#enroll")?.addEventListener("click", () => safe(async () => {
    const data = await unwrap(db.auth.mfa.enroll({ factorType: "totp", friendlyName: "Store owner " + (/* @__PURE__ */ new Date()).toISOString().slice(0, 10) }));
    factorId = data.id;
    document.querySelector("#mfa-enroll").textContent = "Add this secret to your authenticator, then enter its code: " + data.totp.secret;
  }));
  document.querySelector("#mfa")?.addEventListener("submit", (event) => safe(async () => {
    event.preventDefault();
    if (!factorId) {
      const data = await unwrap(db.auth.mfa.listFactors());
      factorId = data.totp.find((f) => f.status === "verified")?.id;
    }
    if (!factorId) throw new Error("Set up an authenticator first.");
    await unwrap(db.auth.mfa.challengeAndVerify({ factorId, code: new FormData(event.target).get("code") }));
    await render();
  }));
  wireEditor(currentResource, {}, render);
  wireBulkImport(render);
  wireCatalogueImport(render);
  document.querySelectorAll("[data-record]").forEach((b) => b.onclick = () => {
    document.querySelector("#record-editor").innerHTML = editorPanel(currentResource, activeRows[Number(b.dataset.record)]);
    wireEditor(currentResource, activeRows[Number(b.dataset.record)], render);
  });
  document.querySelector("#download-records")?.addEventListener("click", () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(activeRows, null, 2)], { type: "application/json" })), a = document.createElement("a");
    a.href = url;
    a.download = currentResource + "-page.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1e3);
  });
  document.querySelector("#order-filter")?.addEventListener("submit", (event) => {
    event.preventDefault();
    location.hash = link("orders", { status: new FormData(event.target).get("status") });
  });
  document.querySelectorAll('[data-zelle-evidence]').forEach(button=>button.onclick=()=>safe(async()=>{
    const result=await invoke('zelle_evidence',{id:button.dataset.zelleEvidence});
    const box=document.querySelector('[data-zelle-evidence-result="'+button.dataset.zelleEvidence+'"]');
    box.innerHTML='<a target="_blank" rel="noopener noreferrer" href="'+e(result.url)+'">Open screenshot (link expires in 60 seconds)</a>';
  }));
  document.querySelectorAll(".admin-order").forEach((form) => form.onsubmit = (event) => safe(async () => {
    event.preventDefault();
    const f = Object.fromEntries(new FormData(form));
    if(['verify_zelle','cancel_zelle'].includes(f.action)&&!f.bank_checked)throw new Error('Confirm the actual bank/customer check before continuing.');
    const message = f.action === "verify_zelle" ? "Confirm you checked actual bank receipt. A screenshot or customer reference is not proof of payment." : f.action === "refund" ? "Confirm this full refund. For Zelle, verify the bank refund was already sent and enter its reference. No stock is automatically restored." : "Apply this order status change?";
    if (!confirm(message)) return;
    const button = form.querySelector("button");
    button.disabled = true;
    try {
      if (f.action === "refund") {
        const result = await unwrap(db.functions.invoke("refund-order", { body: { id: form.dataset.id, bank_reference: f.value } }));
        notify("Refund status: " + result.status);
      } else if(f.action==="cancel_zelle")await unwrap(db.rpc("cancel_unreceived_zelle",{p_id:form.dataset.id,p_bank_check:f.value}));
      else await unwrap(db.rpc("admin_order", { p_id: form.dataset.id, p_action: f.action, p_value: f.value, p_carrier: f.carrier }));
      await render();
    } finally {
      button.disabled = false;
    }
  }));
  document.querySelectorAll("[data-review]").forEach((b) => b.onclick = () => safe(async () => {
    await unwrap(db.from("reviews").update({ approved: b.dataset.approved === "true" }).eq("id", b.dataset.review));
    await render();
  }));
  document.querySelectorAll("[data-message]").forEach((b) => b.onclick = () => safe(async () => {
    await unwrap(db.from("contact_messages").update({ handled: true }).eq("id", b.dataset.message));
    await render();
  }));
}
export {
  adminPage,
  wireAdmin
};
