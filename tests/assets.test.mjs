import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import sharp from "sharp";
test("published images have local files and documented approval", async () => {
  const manifest = JSON.parse(await readFile("data/image-manifest.json", "utf8"));
  for (const m of manifest.filter((m2) => m2.local_path)) {
    assert.equal(m.permission_status, "approved");
    assert.equal(m.quality_status, "approved");
    const data = await sharp(m.local_path).metadata();
    if (m.permission_basis === 'owner_confirmed') {
      assert.match(m.source_sha256, /^[0-9a-f]{64}$/);
      assert.ok(Math.max(data.width, data.height) >= 400);
    } else {
      assert.match(m.original_source, /^https:\/\/commons.wikimedia.org\/wiki\/File:/);
      assert.match(m.licence_url, /^https:\/\/creativecommons.org\//);
      assert.ok(m.author);
      assert.ok(data.width >= 960);
    }
    assert.ok((await stat(m.local_path)).size < 6e5);
  }
  assert.equal(manifest.find((m) => m.product_id === "airpods-4").local_path, null);
});
test("draft products never advertise invented stock or sale prices", async () => {
  const drafts = JSON.parse(await readFile("data/products.json", "utf8"));
  for (const p of drafts.filter((p2) => !p2.published)) for (const v of p.variants) {
    assert.equal(v.active, false);
    assert.equal(v.price_cents, null);
    assert.equal(v.inventory, null);
  }
});
