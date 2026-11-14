import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {previewProducts} from '../js/catalogue-preview.js';
import {safeImage,money,filterProducts} from '../js/core.js';
import {catalogueDirectory} from '../js/catalogue-directory.js';
import {iphonePricingPage} from '../js/iphone-pricing.js';
import {ownerPreviewProducts} from '../js/owner-catalogue-preview.js';
import {productImages} from '../js/product-media.js';

test('owner image review isolates colours, withholds ambiguous assets and retains all original references',async()=>{
 const [drafts,manifest]=await Promise.all(['data/products.json','data/owner-image-manifest.json'].map(async path=>JSON.parse(await readFile(path,'utf8'))));
 assert.equal(manifest.records.filter(r=>!r.source_archive_sha256).length,86);assert.equal(manifest.records.filter(r=>!r.source_archive_sha256&&r.path).length,71);
 const zip=manifest.records.filter(r=>r.source_archive_sha256);assert.equal(zip.length,28);assert.equal(zip.filter(r=>r.path).length,5);
 assert.ok(zip.filter(r=>r.path).every(r=>r.product_id==='lenovo-legion-tower-5-gen-10-rtx-5070-ti'&&r.width>=960&&r.height>=960));
 assert.ok(zip.filter(r=>r.width<960&&r.height<960).every(r=>!r.path));
 assert.ok(manifest.records.every(r=>r.original_local_path&&r.source_sha256&&r.permission_status==='commercial_permission_unconfirmed'));
 const preview=ownerPreviewProducts(drafts,manifest);assert.equal(preview.length,53);
 for(const p of preview){assert.equal(p.review_only,true);assert.equal(p.price,p.catalogue_update?p.sale_price_cents:null);for(const v of p.variants){assert.equal(v.stock,null);assert.equal(v.active,false);assert.equal(productImages(p,v).length,v.images.length);assert.ok(v.images.every(i=>i.color===v.color&&i.product_id===p.id));assert.equal(new Set(v.images.map(i=>i.source_sha256||i.path)).size,v.images.length);}}
 assert.ok(preview.find(p=>p.id==='ibuypower-ryzen-5-9500f').variants.every(v=>v.images.length===0));
 assert.equal(preview.find(p=>p.id==='lenovo-legion-tower-5-gen-10-rtx-5070-ti').variants[0].images.length,5);
 assert.ok(preview.find(p=>p.id==='airpods-max-usbc').catalogue_update);assert.ok(preview.find(p=>p.id==='airpods-4').catalogue_update);
 assert.ok(preview.find(p=>p.id==='airpods-5').variants[0].images.every(i=>i.product_id==='airpods-5'));
});

test('iPhone price proposals subtract exactly $200 without activating unconfirmed offers',async()=>{
 const plan=JSON.parse(await readFile('data/iphone-pricing.json','utf8'));
 assert.equal(plan.rows.length,21);
 for(const row of plan.rows){assert.equal(row.reference_price_cents-row.proposed_price_cents,20000);assert.ok(Math.abs(row.discount_percent-20000/row.reference_price_cents*100)<1e-9);assert.equal(row.inventory,15);assert.equal(row.published,false);}
 assert.deepEqual(plan.rows.filter(r=>r.product_id==='iphone-16').map(r=>r.storage),['128GB','256GB']);
 const html=iphonePricingPage(plan,'iphone-17');
 assert.ok(html.includes(money(72900)));assert.ok(html.includes('21.5%'));assert.ok(html.includes(`<s>${money(92900)}</s>`));assert.ok(html.includes('not our previous selling price'));assert.ok(!html.includes('<button'));
});
test('read-only preview requires exact product/photo approval and never implies stock or pricing',()=>{
 const drafts=[{id:'real',name:'Real model',variants:[{image_path:'images/products/real.webp',price_cents:100,inventory:8}]},{id:'wrong-model',variants:[{image_path:'images/products/real.webp'}]},{id:'generated',variants:[{image_path:'images/studio/real.webp'}]}];
 const result=previewProducts(drafts,[{product_id:'real',local_path:'images/products/real.webp',permission_status:'approved',quality_status:'approved'}]);
 assert.equal(result.length,1);assert.equal(result[0].review_only,true);assert.equal(result[0].price,null);assert.equal(result[0].variants[0].stock,null);assert.equal(result[0].variants[0].price_cents,null);assert.equal(result[0].variants[0].active,false);
 assert.equal(money(null),'Pricing to be confirmed');assert.equal(safeImage('images/studio/real.webp'),null);assert.equal(safeImage('images/research/real.webp'),null);
 assert.equal(filterProducts(result,{available:true}).length,0);assert.equal(filterProducts(result,{min:'1'}).length,0);
});
test('historical drafts remain intact while public navigation contains only the four current collections',async()=>{
 const [products,store,manifest]=await Promise.all(['data/products.json','config/store.json','data/image-manifest.json'].map(async p=>JSON.parse(await readFile(p,'utf8'))));
 assert.equal(products.length,53);assert.deepEqual(store.categories,["Apple iPhones","Apple Products and Headphones","Gaming Consoles","Gaming PCs"]);assert.equal(new Set(products.map(p=>p.id)).size,products.length);
 for(const p of products){assert.ok([...store.categories,"Gaming Controllers","Processors and CPUs"].includes(p.category));assert.equal(p.officially_released,true);assert.equal(p.published,false);assert.equal(p.sale_price_cents,p.catalogue_update?.configurations.reduce((n,v)=>Math.min(n,v.price_cents),Infinity)??null);assert.equal(p.inventory,p.catalogue_update?15:null);assert.ok(p.verification_source.startsWith('https://'));assert.ok(!/laptop|OS4/i.test(p.name));if(p.product_type==='Smartphone')assert.equal(p.brand,'Apple');if(p.category==='Apple Products and Headphones')assert.equal(p.brand,'Apple');if(p.category==='Gaming PCs')assert.match(p.name,/CORSAIR VENGEANCE a7500|Alienware Area-51|CyberPowerPC|iBUYPOWER|Acer Nitro 85|Lenovo Legion Tower 5/);}
 for(const id of ['cyberpowerpc-et99707','ibuypower-ryzen-5-9500f','acer-nitro-85-n85-100-ur35','lenovo-legion-tower-5-gen-10-rtx-5070-ti','ps5-pro-2tb']){const p=products.find(p=>p.id===id);assert.ok(p);assert.equal(p.image_path,null);assert.equal(p.variants.length,0);assert.equal(p.price_reference,null);}
 assert.equal(products.find(p=>p.id==='ibuypower-ryzen-5-9500f').model_number,null);
 assert.equal(products.find(p=>p.id==='lenovo-legion-tower-5-gen-10-rtx-5070-ti').model_number,'90YJ001LUS');
 assert.equal(products.find(p=>p.id==='ibuypower-ryzen-5-9500f').specification_origin,'owner_workbook');
 const pcImport=JSON.parse(await readFile('data/pc-details-import.json','utf8'));assert.equal(pcImport.matched_count,5);assert.equal(pcImport.created_count,0);
 for(const record of pcImport.records){const p=products.find(p=>p.id===record.product_id);assert.equal(p.supplied_details.source_file,'Electronics_catalogue_all_products_priced.xlsx');assert.equal(p.supplied_details.raw['Product Name'],record.raw['Product Name']);assert.equal(p.sale_price_cents,p.catalogue_update?.configurations.reduce((n,v)=>Math.min(n,v.price_cents),Infinity)??null);assert.equal(p.inventory,p.catalogue_update?15:null);const html=catalogueDirectory([p],[p.category]);assert.ok(html.includes('Supplied reference details'));assert.ok(html.includes('not an active store offer')||p.supplied_price_reference.price_cents===null);}
 const preview=previewProducts(products,manifest);assert.equal(preview.length,4);assert.ok(preview.every(p=>p.variants.every(v=>safeImage(v.image_path))));
});
test('frontend build contains genuine images and no generated image assets or references',async()=>{
 const app=await readFile('dist/js/app.js','utf8');assert.ok(!app.includes('images/studio/'));
 assert.ok(!(await readdir('dist/data')).some(f=>f.includes('studio')));
 let obsolete=[];try{obsolete=await readdir('dist/images/studio');}catch(e){if(e.code!=='ENOENT')throw e;}assert.deepEqual(obsolete,[]);
 const manifest=JSON.parse(await readFile('data/image-manifest.json','utf8'));
 for(const image of manifest.filter(m=>m.local_path)){assert.equal(image.image_kind,image.permission_basis==='owner_confirmed'?'owner_supplied_product_asset':'genuine_photograph');assert.ok(image.source_sha256);await readFile('dist/'+image.local_path);}
});
test('model directory shows verified research without image substitutes or sale claims',()=>{
 const html=catalogueDirectory([{id:'test',name:'<unsafe>',category:'Gaming PCs',description:'Exact model',specifications:{GPU:'RTX 5080'},verification_source:'https://example.com/model',image_path:null}],['Gaming PCs']);
 assert.ok(html.includes('&lt;unsafe&gt;'));assert.ok(html.includes('RTX 5080'));assert.ok(!html.includes('<img'));assert.ok(html.includes('Photograph and sale details pending'));assert.ok(!html.includes('In Stock'));
});
