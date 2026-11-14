import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep, basename } from "node:path";
import { buildSEO, jsonLD } from "../scripts/seo.mjs";
test("static metadata escapes customer-controlled text and excludes unpublished products", async () => {
  const dir = await mkdtemp(join(tmpdir(), "store-seo-"));
  try {
    const id = "11111111-1111-4111-8111-111111111111";
    const product = { database_id: id, published: true, verification_source: "https://example.com/test", name: "Test <\/script><script>alert(1)<\/script>", description: 'Test "description"', brand: "Test", variants: [{ active: true, price_cents: 12345, image_path: "images/products/dualsense-white-960.webp", image_permission: "approved", inventory: 2, color: "White", sku: "TEST" }] };
    const urls = await buildSEO({ domain: "https://example.com/store/", name: "Test store" }, { outputDirectory: dir, products: [product, { ...product, database_id: "22222222-2222-4222-8222-222222222222", published: false }], content: { about: { title: "About", approved: true, paragraphs: ["Test only"] } } });
    assert.equal(urls.length, 4);
    const html = await readFile(join(dir, "pages/products/" + id + ".html"), "utf8");
    assert.ok(!html.includes("<script>alert(1)<\/script>"));
    assert.ok(html.includes("BreadcrumbList"));
    assert.ok(html.includes("https://example.com/store/pages/products/" + id + ".html"));
    assert.ok(html.includes('<base href="../../">'));
    const schema = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
    assert.equal(schema["@graph"][0].name, product.name);
    assert.equal(schema["@graph"][0].offers[0].price, "123.45");
    assert.equal(JSON.parse(jsonLD({ text: "<x>" })).text, "<x>");
  } finally {
    const target = resolve(dir);
    assert.ok(target.startsWith(resolve(tmpdir()) + sep) && basename(target).startsWith("store-seo-"));
    await rm(target, { recursive: true });
  }
});

