const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const money = (cents) => Number.isFinite(cents) ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100) : 'Pricing to be confirmed';
function normalizeCart(items) {
  const map = /* @__PURE__ */ new Map();
  for (const row of Array.isArray(items) ? items : []) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.variant_id) || !Number.isInteger(row.quantity) || row.quantity < 1) continue;
    map.set(row.variant_id, Math.min(99, (map.get(row.variant_id) || 0) + row.quantity));
  }
    return [...map].map(([variant_id, quantity]) => ({ variant_id, quantity }));
}
function filterProducts(products, { q = "", category = "", brand = "", min = "", max = "", available = false, sort = "featured", color = "", configuration = "", type = "" } = {}) {
  const query = q.trim().toLowerCase();
  const result = products.filter((p) => (!query || [p.name, p.brand, p.model, p.category, ...p.keywords || []].join(" ").toLowerCase().includes(query)) && (!category || p.category === category) && (!brand || p.brand === brand) && (!type || p.product_type === type) && p.variants.some((v) => (!available || v.stock > 0 || p.review_only && p.catalogue_update && p.model_stock > 0) && (!color || v.color === color) && (!configuration || v.configuration === configuration)) && (min === "" || Number.isFinite(p.price)&&p.price >= Number(min) * 100) && (max === "" || Number.isFinite(p.price)&&p.price <= Number(max) * 100));
  return result.sort((a, b) => ['low','high'].includes(sort)&&Number.isFinite(a.price)!==Number.isFinite(b.price)?Number.isFinite(a.price)?-1:1: sort === "rating" ? (b.rating || 0) - (a.rating || 0) : sort === "low" ? a.price - b.price : sort === "high" ? b.price - a.price : sort === "name" ? a.name.localeCompare(b.name) : sort === "newest" ? new Date(b.created_at) - new Date(a.created_at) : Number(b.featured) - Number(a.featured));
}
const safeImage = (value) => typeof value === "string" && /^images\/[a-zA-Z0-9/_.-]+\.(webp|avif|png|jpg|jpeg)$/.test(value) && !value.includes("..") && !/^images\/(studio|research|imports|originals)\//.test(value) ? value : null;
export {
  escapeHTML,
  filterProducts,
  money,
  normalizeCart,
  safeImage
};
