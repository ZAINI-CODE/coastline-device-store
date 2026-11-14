import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {buildSEO,seoSettings} from '../scripts/seo.mjs';
import {fetchPublishedCatalogue} from '../scripts/seo-catalogue.mjs';
const id='11111111-1111-4111-8111-111111111111',vid='22222222-2222-4222-8222-222222222222';
const product={id,name:'Fixture Phone',brand:'Test',model:'Fixture',description:'Description with "quotes" and <markup>',category:'Apple iPhones',specifications:{Storage:'128GB'},variants:[{id:vid,sku:'FIXTURE',color:'Black',configuration:'128GB',active:true,stock:2,price_cents:10000,image_path:'images/products/dualsense-white-960.webp',gallery_paths:[]}]};
test('public catalogue fetch fails closed rather than using old draft records',async()=>{
 const calls=[];
 const rows=await fetchPublishedCatalogue({supabaseUrl:'https://project.invalid',supabaseKey:'public-fixture'},async(u,options)=>{calls.push([u,options]);return Response.json(u.includes('rpc/')?[product]:[]);});
 assert.equal(rows.products.length,1);assert.ok(calls.every(x=>x[1].headers.apikey==='public-fixture'));
 await assert.rejects(()=>fetchPublishedCatalogue({supabaseUrl:'https://project.invalid',supabaseKey:'public-fixture'},async()=>new Response('',{status:503})),/build stopped/);
});
test('temporary host canonical, crawlable links, snapshot discounts and incomplete Offer omission',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'coastline-seo-'));
 try{
  const env={PUBLIC_SITE_URL:'https://coastline-test.netlify.app',PUBLIC_INDEXING_ENABLED:'true'};
  const missing={...product,id:'33333333-3333-4333-8333-333333333333',name:'Incomplete fixture',variants:[{...product.variants[0],active:false,price_cents:null,stock:null}]};
  const promo={active:true,kind:'quantity',minimum_quantity:1,percent_basis_points:1500,discount_cents:0,starts_at:'2026-11-01',ends_at:'2027-01-02T05:00:00Z',promotion_products:[{product_id:id}]};
  await buildSEO({name:'Coastline Device',domain:'https://old.invalid',categories:[]},{products:[product,missing],promotions:[promo],env,now:Date.parse('2026-11-13T00:00:00Z'),outputDirectory:dir,content:{}});
  const html=await readFile(join(dir,'pages/products/'+id+'.html'),'utf8');
  assert.match(html,/<meta name="robots" content="index,follow">/);assert.match(html,/https:\/\/coastline-test.netlify.app\/pages\/products/);assert.doesNotMatch(html,/https:\/\/old.invalid/);
  assert.match(html,/property="og:image"/);assert.match(html,/Storage/);
  const json=JSON.parse(html.match(/application\/ld\+json">(.*?)<\/script>/s)[1]);
  assert.equal(json['@graph'][0].offers[0].price,'85.00');assert.ok(!json['@graph'][0].aggregateRating);
  const missingHTML=await readFile(join(dir,'pages/products/'+missing.id+'.html'),'utf8');assert.ok(!JSON.parse(missingHTML.match(/application\/ld\+json">(.*?)<\/script>/s)[1])['@graph'][0].offers);
  assert.equal((await readdir(join(dir,'pages/products'))).length,2);
  assert.match(await readFile(join(dir,'index.html'),'utf8'),/href="\.\/pages\/products\//);
  assert.match(await readFile(join(dir,'categories/apple-iphones/index.html'),'utf8'),/Fixture Phone/);
  assert.match(await readFile(join(dir,'sitemap.xml'),'utf8'),/categories\/apple-iphones/);
  assert.equal(await readFile(join(dir,'robots.txt'),'utf8'),'User-agent: *\nAllow: /\nSitemap: https://coastline-test.netlify.app/sitemap.xml\n');
 }finally{assert.ok(resolve(dir).startsWith(resolve(tmpdir())+sep));await rm(dir,{recursive:true});}
});
test('indexing and deployment base are explicit, portable and reject unsafe URLs',()=>{
 assert.equal(seoSettings({}, {VERCEL_URL:'preview.vercel.app'}).home,'https://preview.vercel.app/');
 assert.equal(seoSettings({}, {DEPLOY_PRIME_URL:'https://preview.netlify.app'}).indexable,false);
 assert.throws(()=>seoSettings({}, {PUBLIC_SITE_URL:'https://user:secret@example.com'}),/SEO base/);
 assert.throws(()=>seoSettings({}, {PUBLIC_INDEXING_ENABLED:'true'}),/requires/);
});
