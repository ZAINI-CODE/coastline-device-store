const resources = {
  product_costs: {label:'Private supplier costs',key:['product_id'],fields:{product_id:['Product','product',true],supplier_cost_cents:['Internal supplier cost in USD cents','integer',true],note:['Private cost note','textarea']}},
  products: { label: "Products", key: ["id"], fields: { id: ["Record ID", "uuid"], name: ["Product name", "text", true], brand: ["Brand", "text", true], model: ["Exact model number", "text", true], category_id: ["Category", "category", true], product_type: ["Product type", "text"], description: ["Description", "textarea"], specifications: ["Verified specifications (JSON object)", "json", false, {}], keywords: ["Search keywords (one per line)", "list"], verification_source: ["Verification source", "url"], verified_at: ["Verification date", "datetime"], featured: ["Featured selection", "boolean"], published: ["Publish product", "boolean"] } },
  product_variants: { label: "Variants & prices", key: ["id"], fields: { id: ["Record ID", "uuid"], product_id: ["Product", "product", true], sku: ["Unique SKU", "text", true], color: ["Colour", "text", true], configuration: ["Storage / configuration", "text", true], price_cents: ["Sale price in USD cents", "integer", true], price_source: ["Price source", "url"], price_verified_at: ["Price verification date", "datetime"], image_path: ["Primary local image path", "text"], gallery_paths: ["Gallery image paths (one per line)", "list"], image_source: ["Image source / evidence", "text"], image_permission: ["Image permission status", "permission"], image_verified_at: ["Image verification date", "datetime"], specifications: ["Variant specifications (JSON object)", "json", false, {}], compatible_product_ids: ["Compatible product IDs (one per line)", "list"], active: ["Activate variant", "boolean"] } },
  inventory: { label: "Inventory", key: ["variant_id"], fields: { variant_id: ["Variant", "variant", true], quantity: ["Actual available units", "integer", true] } },
  categories: { label: "Categories", key: ["id"], fields: { id: ["Record ID", "uuid"], name: ["Category name", "text", true] } },
  shipping_rules: { label: "Shipping & tax rules", key: ["id"], fields: { id: ["Record ID", "uuid"], country: ["Country code", "text", true], state: ["State / region code", "text", true], method: ["Shipping method", "text", true], price_cents: ["Shipping price in USD cents", "integer", true], tax_basis_points: ["Approved tax basis points (100 = 1%)", "integer"], delivery_description: ["Actual delivery estimate", "text", true], free_over_cents: ["Free shipping threshold in cents (optional)", "integer"], approved: ["Enable approved rule", "boolean"] } },
  promotions: { label: "Promotions", key: ["id"], fields: { id: ["Record ID", "uuid"], name: ["Offer name", "text", true], kind: ["Offer type", "kind", true], minimum_quantity: ["Minimum quantity per bundle product / eligible quantity", "integer", true, 1], percent_basis_points: ["Percentage basis points (100 = 1%)", "integer", true, 0], discount_cents: ["Or fixed discount in USD cents", "integer", true, 0], starts_at: ["Starts", "datetime", true], ends_at: ["Expires", "datetime", true], active: ["Activate promotion", "boolean"] } },
  promotion_products: { label: "Offer eligibility", key: ["promotion_id", "product_id"], fields: { promotion_id: ["Promotion", "promotion", true], product_id: ["Eligible product", "product", true] } },
  store_settings: { label: "Checkout launch settings", key: ["id"], fields: { id: ["Singleton key", "hidden", true, true], checkout_enabled: ["Enable transactions after acceptance testing", "boolean"], policies_approved: ["Policies have been reviewed and approved", "boolean"], max_open_reservations: ["Maximum unpaid reservations per customer", "integer", true, 5] } }
};
Object.assign(resources.products.fields,{catalogue_key:['Catalogue identity','text'],demo_only:['Provisional demonstration model (blocks orders)','boolean'],price_label:['Customer price label','text'],catalogue_note:['Customer catalogue note','textarea']});
Object.assign(resources.product_variants.fields,{catalogue_key:['Catalogue identity','text'],catalogue_visible:['Show in catalogue (even while orders are disabled)','boolean']});
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function parseRecord(resource, form) {
  const schema = resources[resource];
  if (!schema) throw new Error("Unknown resource.");
  const row = {};
  for (const [name, [label, type, required, fallback]] of Object.entries(schema.fields)) {
    const value = form.get(name);
    if (type === "hidden") {
      row[name] = fallback;
      continue;
    }
    if (type === "boolean") {
      row[name] = form.has(name);
      continue;
    }
    const str = String(value ?? "").trim();
    if (required && !str) throw new Error(label + " is required.");
    if (!str) {
      if (type === "uuid") continue;
      row[name] = name === "description" ? "" : type === "list" ? [] : type === "json" ? fallback || {} : null;
      continue;
    }
    if (type === "integer") {
      const n = Number(str);
      if (!Number.isSafeInteger(n) || n < 0) throw new Error(label + " must be a non-negative whole number.");
      row[name] = n;
    } else if (type === "datetime") {
      const date = new Date(str);
      if (!Number.isFinite(date.getTime())) throw new Error("Invalid " + label);
      row[name] = date.toISOString();
    } else if (type === "json") {
      const parsed = JSON.parse(str);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(label + " must be a JSON object.");
      row[name] = parsed;
    } else if (type === "list") {
      row[name] = [...new Set(str.split(/\r?\n/).map((v) => v.trim()).filter(Boolean))];
      if (name === "compatible_product_ids" && row[name].some((id) => !uuid.test(id))) throw new Error("Compatibility IDs must be valid product IDs.");
    } else {
      if (["uuid", "category", "product", "variant", "promotion"].includes(type) && !uuid.test(str)) throw new Error("Invalid " + label);
      if (type === "url" && !/^https:\/\//i.test(str)) throw new Error(label + " must use HTTPS.");
      row[name] = str;
    }
  }
  if (resource === "promotions") {
    if (row.percent_basis_points > 0 && row.discount_cents > 0) throw new Error("Choose either a percentage or a fixed discount.");
    if (row.minimum_quantity < 1 || row.percent_basis_points > 1e4) throw new Error("Invalid promotion quantity or percentage.");
    if (row.starts_at >= row.ends_at) throw new Error("Expiry must follow the start date.");
  }
  return row;
}
function recordsFromJSON(resource, value) {
  if (resource === "store_settings" || !resources[resource]) throw new Error("This resource does not support bulk import.");
  if (!Array.isArray(value) || value.length < 1 || value.length > 200) throw new Error("Provide 1\u2013200 complete records per import.");
  return value.map((record, index) => {
    if (!record || Array.isArray(record) || typeof record !== "object") throw new Error("Invalid record at row " + (index + 1));
    const form = new FormData();
    for (const [name, [, type]] of Object.entries(resources[resource].fields)) {
      const v = record[name];
      if (type === "boolean") {
        if (v === true) form.set(name, "on");
        continue;
      }
      if (v === null || v === void 0) continue;
      form.set(name, type === "list" ? Array.isArray(v) ? v.join("\n") : String(v) : type === "json" ? JSON.stringify(v) : String(v));
    }
    try {
      return parseRecord(resource, form);
    } catch (error) {
      throw new Error(`Row ${index + 1}: ${error.message}`);
    }
  });
}
export {
  parseRecord,
  recordsFromJSON,
  resources
};
