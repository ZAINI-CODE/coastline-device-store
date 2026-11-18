import http from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
const uid = "11111111-1111-4111-8111-111111111111", now = Math.floor(Date.now() / 1e3), encode = (v) => Buffer.from(JSON.stringify(v)).toString("base64url");
const token = encode({ alg: "HS256", typ: "JWT" }) + "." + encode({ sub: uid, role: "authenticated", aal: "aal2", exp: now + 3600, iat: now, aud: "authenticated" }) + ".local-qa-only";
const user = { id: uid, aud: "authenticated", role: "authenticated", email: "owner@qa.invalid", email_confirmed_at: (/* @__PURE__ */ new Date()).toISOString(), app_metadata: { provider: "email" }, user_metadata: {}, created_at: (/* @__PURE__ */ new Date()).toISOString() };
const tables = { products: [], product_variants: [], inventory: [], categories: [{ id: "22222222-2222-4222-8222-222222222222", name: "QA only \u2014 disposable category" }], promotions: [], promotion_products: [], orders: [], reviews: [], review_reports: [], admin_audit_logs: [], contact_messages: [], customer_addresses: [], profiles: [], carts: [], store_settings: [{ id: true, checkout_enabled: false, policies_approved: false }] };
// Optional public-catalogue snapshot is used only by the isolated redesign checks.
const catalogue = process.env.QA_CATALOGUE_FILE ? JSON.parse(await readFile(process.env.QA_CATALOGUE_FILE,'utf8')) : [];
tables.inventory_adjustments=[];
tables.shipping_rules=[];
tables.product_costs=[];
let confirmationSubmitted=false;
if(catalogue.length)tables.orders=[{id:'66666666-6666-4666-8666-666666666666',user_id:uid,created_at:new Date().toISOString(),expires_at:new Date(Date.now()+3600000).toISOString(),method:'zelle',payment_status:'pending',status:'pending',stock_released:false,subtotal_cents:10000,total_cents:10000,discount_cents:0,shipping_cents:0,tax_cents:0,shipping_address:{full_name:'Local QA Customer',line1:'100 Test Street',city:'Anchorage',state:'AK',postal_code:'99501',country:'US'},order_items:[{product_name:'Local disposable selection',sku:'LOCAL-ONLY',variant:'Local UI fixture',quantity:1,unit_price_cents:10000,discount_cents:0}],order_status_history:[],payments:{reference:null}}];
const root = resolve("dist"), types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg":"image/svg+xml", ".ico":"image/x-icon", ".webp": "image/webp", ".png": "image/png", ".xml": "application/xml" };
function send(res, data, status = 200, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*", ...headers });
  res.end(JSON.stringify(data));
}
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://127.0.0.1:4174");
    if (req.method === "OPTIONS") return send(res, null);
    const raw = await new Promise((done, fail) => {
      let data = "";
      req.on("data", (c) => {
        data += c;
        if (data.length > 2e6) fail(new Error("Too large"));
      });
      req.on("end", () => done(data));
    });
    let body = raw ? JSON.parse(raw) : null;
    if (url.pathname === "/config/public.json") return send(res, { supabaseUrl: "http://127.0.0.1:4174", supabaseKey: "local-qa-public-key", paypalClientId: "" });
    if (url.pathname === "/auth/v1/token") return send(res, { access_token: token, refresh_token: "local-qa-only", token_type: "bearer", expires_in: 3600, expires_at: now + 3600, user });
    if (url.pathname === "/auth/v1/user") return send(res, user);
    if (url.pathname === "/auth/v1/recover") return send(res, {});
    if (url.pathname === "/auth/v1/signup") return send(res, {user,session:null});
    if (url.pathname === "/auth/v1/logout") return send(res, {});
    if (url.pathname === '/functions/v1/store-api'){
      if(body.action==='zelle_instructions')return send(res,{recipientName:'Local UI fixture',recipient:'fixture@example.invalid',total_cents:10000,submitted:confirmationSubmitted,reference:confirmationSubmitted?'LOCAL-REFERENCE':null});
      if(body.action==='zelle_reference'){confirmationSubmitted=true;return send(res,{});}
      return send(res,{error:'Unsupported local UI action'},400);
    }
    if (url.pathname === "/rest/v1/rpc/is_admin") return send(res, req.headers.authorization === "Bearer " + token);
    if (url.pathname === "/rest/v1/rpc/storefront_catalogue") return send(res, catalogue);
    if (url.pathname === "/rest/v1/rpc/sync_my_profile") return send(res, null);
    if (url.pathname === "/rest/v1/rpc/my_product_reviews") return send(res, []);
    if (url.pathname === "/rest/v1/rpc/send_contact") {
      if (req.headers.authorization !== "Bearer " + token) return send(res, {message:"Sign in"}, 401);
      tables.contact_messages.push({id:crypto.randomUUID(),user_id:uid,subject:body.p_subject,message:body.p_message,created_at:new Date().toISOString(),handled:false});
      return send(res, null);
    }
    if (url.pathname === "/rest/v1/rpc/admin_store_summary") return send(res, { orders: 0, pending_payments: 0, paid_orders: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0, products: tables.products.length, published_products: 0, available_units: 0, captured_cents: 0, refunded_cents: 0, pending_reviews: 0, open_messages: 0, reconciliation_alerts: 0 });
    if (url.pathname.startsWith("/rest/v1/")) {
      const table = url.pathname.split("/")[3];
      if (!Object.hasOwn(tables, table)) return send(res, { message: "Unknown QA resource" }, 404);
      let rows = tables[table].filter((row) => [...url.searchParams].every(([key, value]) => ["select", "order", "limit", "offset", "on_conflict"].includes(key) || !value.startsWith("eq.") || String(row[key]) === value.slice(3)));
      if (req.method === "POST") {
        const incoming = Array.isArray(body) ? body : [body];
        for (const row of incoming) {
          const key = table === "inventory" ? "variant_id" : table === "carts" ? "user_id" : "id";
          row[key] ??= crypto.randomUUID();
          const existing = tables[table].find((r) => r[key] === row[key]);
          if (existing) Object.assign(existing, row);
          else tables[table].push(row);
        }
        return send(res, incoming, 201);
      }
      if (req.method === "PATCH") {
        for (const row of rows) Object.assign(row, body);
        return send(res, rows);
      }
      if (req.method === "DELETE") {
        tables[table] = tables[table].filter((r) => !rows.includes(r));
        return send(res, []);
      }
      const count = rows.length, offset = Number(url.searchParams.get("offset") || 0), limit = Number(url.searchParams.get("limit") || 1e3);
      rows = rows.slice(offset, offset + limit);
      return send(res, req.headers.accept?.includes("vnd.pgrst.object") ? rows[0] || null : rows, 200, { "Content-Range": `${offset}-${offset + Math.max(0, rows.length - 1)}/${count}` });
    }
    const target = resolve(root, "." + decodeURIComponent(url.pathname));
    if (target !== root && !target.startsWith(root + sep)) return send(res, { error: "Forbidden" }, 403);
    const file = target === root ? resolve(root, "index.html") : target;
    let bytes = await readFile(file);
    if (extname(file) === ".html") bytes = Buffer.from(bytes.toString().replace("<body>", '<body><aside class="qa-banner" role="note">LOCAL QA FIXTURE \u2014 disposable test records, no real authentication or payments</aside>'));
    res.writeHead(200, { "Content-Type": types[extname(file)] || "text/plain", "Cache-Control": "no-store" });
    res.end(bytes);
  } catch (error) {
    send(res, { message: error.message }, 500);
  }
}).listen(4174, "127.0.0.1", () => console.log("QA fixture: http://127.0.0.1:4174 \xB7 owner@qa.invalid \xB7 password: any test value. No real services."));
