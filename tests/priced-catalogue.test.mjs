import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ownerPreviewProducts} from '../js/owner-catalogue-preview.js';
import {specificationsMarkup} from '../js/product-specifications.js';
import {productCard} from '../js/storefront-ui.js';
import {filterProducts} from '../js/core.js';
import {purchaseLimit} from '../js/product-options.js';
const products=JSON.parse(await readFile('data/products.json','utf8'));
const media=JSON.parse(await readFile('data/owner-image-manifest.json','utf8'));
const preview=ownerPreviewProducts(products,media);
test('all 52 workbook models preserve draft figures privately and omit them from product cards',()=>{
 const rows=preview.filter(p=>p.catalogue_update?.source_file==='Electronics_catalogue_all_products_priced.xlsx');
 assert.equal(rows.length,52);assert.equal(new Set(rows.map(p=>p.id)).size,52);
 assert.equal(rows.reduce((n,p)=>n+p.model_stock,0),780);
 assert.equal(filterProducts(rows,{available:true}).length,52);
 for(const p of rows){assert.equal(p.inventory,15);assert.equal(p.model_stock,15);assert.match(productCard(p),/Stock not confirmed/);assert.doesNotMatch(productCard(p),/In Stock|15 total per model|\$[\d,]+\.\d\d/);assert.ok(p.price>0);for(const v of p.variants){assert.equal(v.stock,null);assert.equal(purchaseLimit(p,v),0);}}
 const extra=preview.find(p=>p.id==='airpods-5');assert.equal(extra.price,12900);assert.equal(extra.model_stock,15);assert.match(extra.price_label,/Manufacturer reference/);assert.match(extra.catalogue_update.pricing_note,/\$149/);
});
test('iPhone storage prices remain distinct and specs change with selected storage',()=>{
 const p=preview.find(p=>p.id==='iphone-16');
 for(const [storage,price] of [['128GB',62900],['256GB',72900]]){
  const vs=p.variants.filter(v=>v.configuration===storage);assert.ok(vs.length);assert.ok(vs.every(v=>v.price_cents===price));
  assert.match(specificationsMarkup(p,vs[0]),new RegExp(storage));
 }
 assert.equal(products.find(p=>p.id==='iphone-17e').catalogue_update.configurations.length,2);
 assert.equal(products.find(p=>p.id==='iphone-duo').catalogue_update.configurations.length,4);
});
test('exact PC prices and detailed components are retained without exposing internal costs',()=>{
 const p=preview.find(p=>p.id==='ibuypower-ryzen-5-9500f');assert.equal(p.price,147900);
 const html=specificationsMarkup(p,p.variants[0]);
 for(const value of ['Lexar NQ7A1','MSI PRO B850-VC EVO','600W','DDR5-6000MHz','2 Type-C and 6 Type-A'])assert.ok(html.includes(value));
 assert.equal(preview.find(p=>p.id==='acer-nitro-85-n85-100-ur35').price,199999);
 assert.equal(preview.find(p=>p.id==='lenovo-legion-tower-5-gen-10-rtx-5070-ti').price,284999);
 assert.ok(!JSON.stringify(products).includes('supplier_cost_cents'));
 assert.ok(!productCard(p).includes('$1,500'));
 assert.ok(!html.includes('150000'));
});
