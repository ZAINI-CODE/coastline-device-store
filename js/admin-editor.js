import { db, unwrap } from "./api.js";
import { escapeHTML as e } from "./core.js";
import { safe, notify } from "./app.js";
import { resources, parseRecord } from "./admin-records.js";
let lookups = {};
async function allRows(table, select) {
  let rows = [];
  for (let offset = 0; ; offset += 500) {
    const batch = await unwrap(db.from(table).select(select).order("id").range(offset, offset + 499));
    rows.push(...batch);
    if (batch.length < 500) return rows;
  }
}
async function loadLookups() {
  const [category, product, variant, promotion] = await Promise.all([allRows("categories", "id,name"), allRows("products", "id,name"), allRows("product_variants", "id,sku"), allRows("promotions", "id,name")]);
  lookups = { category, product, variant, promotion };
}
function input(name, [label, type, required, fallback], value) {
  value = value ?? fallback ?? "";
  const req = required ? "required" : "";
  if (type === "hidden") return `<input type="hidden" name="${name}" value="true">`;
  if (type === "boolean") return `<label class="check"><input type="checkbox" name="${name}" ${value ? "checked" : ""}> ${e(label)}</label>`;
  if (lookups[type]) return `<label>${e(label)}<select name="${name}" ${req}><option value="">Choose\u2026</option>${lookups[type].map((r) => `<option value="${e(r.id)}" ${value === r.id ? "selected" : ""}>${e(r.name || r.sku)}</option>`).join("")}</select></label>`;
  if (type === "kind" || type === "permission") {
    const options = type === "kind" ? ["bundle", "quantity"] : ["pending", "approved"];
    return `<label>${e(label)}<select name="${name}" ${req}>${options.map((v) => `<option ${v === value ? "selected" : ""}>${v}</option>`).join("")}</select></label>`;
  }
  if (type === "json" || type === "list" || type === "textarea") return `<label>${e(label)}<textarea name="${name}" rows="${type === "json" ? 5 : 3}" ${req}>${e(type === "json" ? JSON.stringify(value || {}, null, 2) : type === "list" ? Array.isArray(value) ? value.join("\n") : "" : value)}</textarea></label>`;
  if (type === "datetime" && value) {
    const d = new Date(value);
    value = new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
  }
  return `<label>${e(label)}<input name="${name}" type="${type === "integer" ? "number" : type === "datetime" ? "datetime-local" : type === "url" ? "url" : "text"}" ${type === "integer" ? 'min="0" step="1"' : ""} value="${e(value)}" ${req} ${type === "uuid" ? "readonly" : ""}></label>`;
}
function editorPanel(resource = "products", record = {}) {
  const schema = resources[resource];
  return `<form id="guided-editor" data-resource="${resource}" class="panel"><h2>${record[schema.key[0]] ? "Edit" : "Add"} ${e(schema.label.toLowerCase())}</h2><div class="editor-fields">${Object.entries(schema.fields).map(([name, definition]) => input(name, definition, record[name])).join("")}</div>${resource==='inventory'?`<label>Adjustment reason<input name="adjustment_reason" minlength="5" maxlength="500" required></label><label class="check"><input type="checkbox" name="provisional" ${record.provisional?'checked':''}> Provisional demo allocation; not verified physical stock</label>`:''}<p class="quote-note">Prices use USD cents. Published products and active variants require verified sources, image permission and owner-confirmed inventory.</p><button class="button">Save changes</button><button type="button" id="new-record">New record</button><div role="status" id="editor-status"></div></form>`;
}
function wireEditor(resource, record = {}, onSaved = () => {
}) {
  const form = document.querySelector("#guided-editor");
  if (!form) return;
  form.onsubmit = (event) => safe(async () => {
    event.preventDefault();
    const button = form.querySelector("button");
    button.disabled = true;
    try {
      const row = parseRecord(resource, new FormData(form));
      if (resource === "store_settings" && !confirm("Apply these checkout launch settings? Enable sales only after acceptance testing and policy approval.")) return;
      const conflict = resources[resource].key.join(",");
      if(resource==='inventory'){
        if(!record.variant_id)throw new Error('Create inventory through the transactional catalogue import.');
        await unwrap(db.rpc('adjust_inventory',{p_variant:row.variant_id,p_expected:record.quantity,p_quantity:row.quantity,p_reason:new FormData(form).get('adjustment_reason'),p_provisional:new FormData(form).has('provisional')}));
      }else await unwrap(resource === "store_settings" ? db.from(resource).update({ checkout_enabled: row.checkout_enabled, policies_approved: row.policies_approved, max_open_reservations: row.max_open_reservations }).eq("id", true) : db.from(resource).upsert(row, { onConflict: conflict }));
      notify("Changes saved.");
      await onSaved();
    } finally {
      button.disabled = false;
    }
  });
  document.querySelector("#new-record").onclick = () => {
    document.querySelector("#record-editor").innerHTML = editorPanel(resource);
    wireEditor(resource, {}, onSaved);
  };
}
export {
  editorPanel,
  loadLookups,
  parseRecord,
  resources,
  wireEditor
};
