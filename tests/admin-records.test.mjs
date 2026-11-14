import test from "node:test";
import assert from "node:assert/strict";
import { parseRecord, recordsFromJSON } from "../js/admin-records.js";
test("guided editor validates amounts, promotion dates and IDs before saving", () => {
  const f = new FormData();
  for (const [k, v] of Object.entries({ name: "Test offer", kind: "bundle", minimum_quantity: "2", percent_basis_points: "1000", discount_cents: "500", starts_at: "2026-11-01T10:00", ends_at: "2026-11-02T10:00" })) f.set(k, v);
  assert.throws(() => parseRecord("promotions", f), /either/);
  f.set("discount_cents", "0");
  assert.equal(parseRecord("promotions", f).percent_basis_points, 1e3);
  f.set("ends_at", "2026-10-01T10:00");
  assert.throws(() => parseRecord("promotions", f), /Expiry/);
  const inventory = new FormData();
  inventory.set("variant_id", "11111111-1111-4111-8111-111111111111");
  inventory.set("quantity", "-2");
  assert.throws(() => parseRecord("inventory", inventory), /non-negative/);
  inventory.set("quantity", "2.5");
  assert.throws(() => parseRecord("inventory", inventory), /whole/);
});
test("bulk import validates every row and preserves zero inventory and false flags", () => {
  const rows = recordsFromJSON("inventory", [{ variant_id: "11111111-1111-4111-8111-111111111111", quantity: 0 }]);
  assert.equal(rows[0].quantity, 0);
  assert.throws(() => recordsFromJSON("inventory", [rows[0], { variant_id: "bad", quantity: 2 }]), /Row 2/);
  assert.throws(() => recordsFromJSON("store_settings", [{}]), /does not support/);
  assert.throws(() => recordsFromJSON("products", []), /1–200/);
});
