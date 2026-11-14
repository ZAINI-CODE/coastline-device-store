import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCart, filterProducts, escapeHTML, safeImage } from "../js/core.js";
test("cart rejects corrupt quantities, merges variants, caps quantities", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  assert.deepEqual(normalizeCart([{ variant_id: id, quantity: 2 }, { variant_id: id, quantity: 100 }, { variant_id: id, quantity: -1 }, { variant_id: "bad", quantity: 1 }]), [{ variant_id: id, quantity: 99 }]);
});
test("customer text is escaped and image paths cannot escape local images", () => {
  assert.equal(escapeHTML('<script>"'), "&lt;script&gt;&quot;");
  assert.equal(safeImage("javascript:alert(1)"), null);
  assert.equal(safeImage("images/../private.jpg"), null);
  assert.equal(safeImage("images/phone.webp"), "images/phone.webp");
});
test("search, category, price, stock and sort combine", () => {
  const products = [{ name: "Phone", brand: "Apple", model: "A", category: "Smartphones", price: 200, variants: [{ stock: 2 }], keywords: [] }, { name: "Audio", brand: "Apple", model: "B", category: "Audio", price: 100, variants: [{ stock: 0 }], keywords: [] }];
  assert.equal(filterProducts(products, { q: "apple", available: true }).length, 1);
  assert.equal(filterProducts(products, { sort: "low" })[0].name, "Audio");
  assert.equal(filterProducts(products, { category: "Audio", max: "0.50" }).length, 0);
});
