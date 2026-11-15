import {storageFixture} from './storage-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {catalogueImportPlan} from '../scripts/catalogue-import-plan.mjs';
import {heroMedia} from '../js/media.js';
import {mediaShape} from '../js/product-media.js';

test('catalogue plan preserves source details, maps stable UUIDs and never invents offers',async()=>{
 const products=JSON.parse(await readFile('data/products.json','utf8'));
 const store={categories:[...new Set(products.map(p=>p.category))]}; // Historical private import fixture, independent of public navigation.
 const plan=catalogueImportPlan(products,store.categories);
 assert.deepEqual(plan,catalogueImportPlan(products,store.categories));
 assert.equal(plan.entries.length,products.length);assert.equal(plan.categories.length,6);
 assert.equal(new Set(plan.entries.map(e=>e.database_id)).size,products.length);
 assert.deepEqual(plan.product_variants,[]);assert.deepEqual(plan.inventory,[]);
 for(const entry of plan.entries){assert.deepEqual(entry.source_record,products.find(p=>p.id===entry.local_id));assert.equal(entry.row.published,false);assert.ok(plan.categories.some(c=>c.id===entry.row.category_id));}
 assert.throws(()=>catalogueImportPlan([products[0],products[0]],store.categories),/duplicate/);
 assert.throws(()=>catalogueImportPlan([{...products[0],category:'Other'}],store.categories),/Unapproved/);
 const p={id:plan.entries[0].database_id,name:'Phone',keywords:['iphone-16'],variants:[{image_path:'images/products/test.webp'}]};
 assert.match(heroMedia([p]),/images\/products\/test.webp/);
 assert.equal(mediaShape({id:p.id,keywords:['iphone-duo'],product_type:'Smartphone'}),'wide');
});

test('every planned product row fits the reviewed PostgreSQL schema and stays private',async()=>{
 const db=new PGlite();
 try{
  await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select '{}'::jsonb$$;grant usage on schema public,auth to anon,authenticated,service_role;");
  await storageFixture(db);
  for(const file of (await readdir('supabase/migrations')).filter(f=>/^\d.*\.sql$/.test(f)).sort())await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
  const products=JSON.parse(await readFile('data/products.json','utf8'));const plan=catalogueImportPlan(products,[...new Set(products.map(p=>p.category))]);
  for(const c of plan.categories)await db.query('insert into categories(id,name) values($1,$2)',[c.id,c.name]);
  for(const {row} of plan.entries){const columns=Object.keys(row);await db.query(`insert into products(${columns.join(',')}) values(${columns.map((_,i)=>'$'+(i+1)).join(',')})`,Object.values(row).map((v,i)=>columns[i]==='specifications'?JSON.stringify(v):v));}
  assert.equal((await db.query('select count(*)::int as count from products')).rows[0].count,plan.entries.length);
  assert.equal((await db.query('select checkout_enabled from store_settings')).rows[0].checkout_enabled,false);
  await db.exec('set role anon');assert.equal((await db.query('select * from products')).rows.length,0);
  await db.exec('reset role; set role authenticated');assert.equal((await db.query('select * from products')).rows.length,0);
 }finally{await db.close();}
});
