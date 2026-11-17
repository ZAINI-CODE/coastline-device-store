import {storageFixture} from './storage-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {persistentCatalogue} from '../scripts/prepare-persistent-catalogue.mjs';
const source=JSON.parse(await readFile('data/products.json','utf8'));
const media=JSON.parse(await readFile('data/owner-image-manifest.json','utf8'));
const manifest=persistentCatalogue(source,media);
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
export async function catalogueDatabase(){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.uid',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('aal',coalesce(current_setting('request.aal',true),'aal1'))$$;grant usage on schema public,auth to anon,authenticated,service_role;`);
 await storageFixture(db);
 for(const file of (await readdir('supabase/migrations')).filter(f=>/^\d.*\.sql$/.test(f)).sort())await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
 // Existing payment tests explicitly enable both methods in this isolated fixture.
 await db.exec("update store_settings set zelle_enabled=true,paypal_enabled=true");
 return db;
}

test('mixed-rate campaign checkout preserves base prices, matches line discounts and is repeatable', async () => {
 const db=await catalogueDatabase();
 try {
  await db.query('insert into auth.users values($1)',[a]);
  await db.exec('update store_settings set checkout_enabled=true,policies_approved=true');
  const items=[];
  for(const [name,category,key,price] of [['Apple iPhone 16','Apple iPhones','iphone-16',66045],['Acer Nitro','Gaming PCs','acer-nitro-85-n85-100-ur35',209999],['Apple AirPods Pro 3','Apple Products and Headphones','airpods-pro-3',26145]]) {
   const cid=(await db.query('insert into categories(name) values($1) on conflict(name) do update set name=excluded.name returning id',[category])).rows[0].id;
   const pid=(await db.query("insert into products(name,brand,model,category_id,catalogue_key,published,verification_source,verified_at) values($1,'Test',$1,$2,$3,true,'https://example.com/test',now()) returning id",[name,cid,key])).rows[0].id;
   const vid=(await db.query("insert into product_variants(product_id,sku,color,configuration,price_cents,active,price_source,price_verified_at) values($1::uuid,$1::uuid::text,$3,'Standard',$2,true,'https://example.com/test',now()) returning id",[pid,price,category==='Gaming PCs'?'Colour to confirm':'Black'])).rows[0].id;
   await db.query('insert into inventory(variant_id,quantity) values($1,15)',[vid]);
   items.push({variant_id:vid,quantity:items.length===0?2:1,price_cents:1});
  }
  const setup=await readFile('supabase/setup/activate-holiday-promotions.sql','utf8');
  await db.exec(setup);
  await db.exec(setup);
  assert.equal((await db.query('select count(*)::int n from promotions')).rows[0].n,1);
  assert.equal((await db.query('select count(*)::int n from promotion_products')).rows[0].n,3);
  // Make the fixture independent of the host date. Production dates stay fixed in the setup SQL.
  await db.exec("update promotions set starts_at=now()-interval '1 day',ends_at=now()+interval '1 day'");
  const shipping=(await db.query("insert into shipping_rules(country,state,method,price_cents,tax_basis_points,approved,delivery_description) values('US','FL','Test',0,0,true,'Test') returning id")).rows[0].id;
  await db.query("select set_config('request.uid',$1,false)",[a]);
  await db.exec('set role authenticated');
  const address={full_name:'Test Buyer',line1:'1 Test Street',city:'Test',postal_code:'00000',state:'FL',country:'US',phone:'+12025550123'};
  const request=crypto.randomUUID();
  const place=()=>db.query('select place_order($1::jsonb,$2::jsonb,$3,$4,$5) id',[JSON.stringify(items),JSON.stringify(address),shipping,'zelle',request]);
  const order=(await place()).rows[0].id;
  assert.equal((await place()).rows[0].id,order);
  const total=(await db.query('select subtotal_cents,discount_cents,total_cents from orders where id=$1',[order])).rows[0];
  assert.deepEqual(total,{subtotal_cents:368234,discount_cents:43948,total_cents:324286});
  assert.deepEqual((await db.query('select discount_cents from order_items where order_id=$1 order by unit_price_cents',[order])).rows.map(r=>r.discount_cents),[3137,19812,20999]);
  await db.exec('reset role');
  assert.deepEqual((await db.query('select price_cents from product_variants order by price_cents')).rows.map(r=>r.price_cents),[26145,66045,209999]);
  assert.deepEqual((await db.query('select quantity from inventory order by quantity')).rows.map(r=>r.quantity),[13,14,14]);
  await db.exec(await readFile('supabase/migrations/020_campaign_product_discounts.sql','utf8'));
 } finally {await db.close();}
});

test('recent sales exposes only a verified rolling seven-day threshold to anonymous customers', async () => {
  const db = await catalogueDatabase();
  try {
    await db.query('insert into auth.users values ($1)', [a]);
    await db.exec('update store_settings set checkout_enabled=true,policies_approved=true');
    const [{id: product}] = (await db.query(`insert into products(name,brand,model,published,verification_source,verified_at)
      values ('Test item','Test','T',true,'https://example.com/test',now()) returning id`)).rows;
    const [{id: variant}] = (await db.query(`insert into product_variants(product_id,sku,color,configuration,price_cents,active,price_source,price_verified_at)
      values ($1,'TEST-SALES','Black','Standard',1000,true,'Local fixture',now()) returning id`, [product])).rows;
    await db.query('insert into inventory(variant_id,quantity) values($1,100)',[variant]);
    async function addOrder(quantity, paymentStatus, ageHours, capture = true) {
      const [{id}] = (await db.query(`insert into orders(user_id,request_id,shipping_address,method,payment_status,subtotal_cents,discount_cents,shipping_cents,tax_cents,total_cents)
        values ($1,gen_random_uuid(),'{"full_name":"Test Buyer","line1":"Test Street","city":"Test City","postal_code":"00000","state":"FL","country":"US","phone":"+12025550123"}','zelle',$2,1000,0,0,0,1000) returning id`, [a,paymentStatus])).rows;
      await db.query(`insert into order_items(order_id,variant_id,product_id,product_name,sku,variant,quantity,unit_price_cents)
        values ($1,$2,$3,'Test item','TEST-SALES','Black',$4,1000)`, [id,variant,product,quantity]);
      await db.query(`insert into payments(order_id,capture_id,verified_at)
        values ($1,$2,now()-$3*interval '1 hour')`, [id,capture ? id : null,ageHours]);
    }
    async function readPublicThreshold() {
      await db.exec('set role anon');
      try {
        await assert.rejects(() => db.query('select order_id from payments'), /permission denied/);
        return (await db.query('select has_recent_product_sales($1) as show_badge', [product])).rows[0].show_badge;
      } finally {
        await db.exec('reset role');
      }
    }
    await addOrder(11,'paid',1);
    await addOrder(12,'pending',1);
    await addOrder(12,'refunded',1);
    await addOrder(12,'paid',169);
    await addOrder(12,'paid',-1);
    await addOrder(12,'paid',1,false);
    assert.equal(await readPublicThreshold(), false);
    await addOrder(1,'paid',167);
    assert.equal(await readPublicThreshold(), true);
    await db.query('update products set published=false where id=$1', [product]);
    assert.equal(await readPublicThreshold(), false);
  } finally {
    await db.close();
  }
});
test('53 model import: 112 stable internal SKUs, 795 demo units, complete prices/specs, no stock reset',async()=>{
 const db=await catalogueDatabase();
 const costs=[{catalogue_key:'ibuypower-ryzen-5-9500f',supplier_cost_cents:130000}];
 const apply=async m=>(await db.query('select import_store_catalogue($1::jsonb,$2::jsonb) as result',[JSON.stringify(m),JSON.stringify(costs)])).rows[0].result;
 try{
  const first=await apply(manifest);assert.equal(first.models,53);assert.equal(first.variants,112);
  assert.ok((await db.query('select p.id,sum(i.quantity)::int n from products p join product_variants v on v.product_id=p.id join inventory i on i.variant_id=v.id group by p.id')).rows.every(r=>r.n===15));
  assert.equal((await db.query('select sum(quantity)::int n from inventory')).rows[0].n,795);
  assert.equal((await db.query('select count(*)::int n from inventory where provisional')).rows[0].n,112);
  const iphone=(await db.query("select v.configuration,v.price_cents from product_variants v join products p on p.id=v.product_id where p.catalogue_key='iphone-16'")).rows;
  assert.ok(iphone.some(v=>v.configuration==='128GB'&&v.price_cents===62900));assert.ok(iphone.some(v=>v.configuration==='256GB'&&v.price_cents===72900));
  for(const p of manifest.products){const row=(await db.query('select * from products where catalogue_key=$1',[p.catalogue_key])).rows[0];assert.equal(row.name,p.name);assert.deepEqual(row.specifications,p.specifications);}
  assert.equal((await apply(manifest)).replayed,true);assert.equal((await db.query('select count(*)::int n from product_variants')).rows[0].n,112);
  const variant=manifest.products[0].variants[0];await db.query('update inventory set quantity=quantity+1 where variant_id=$1',[variant.id]);
  await apply(manifest);assert.equal((await db.query('select quantity from inventory where variant_id=$1',[variant.id])).rows[0].quantity,variant.quantity+1);
  const changed=structuredClone(manifest);changed.products[0].description+=' Updated';
  await assert.rejects(()=>apply(changed),/inventory differs/);assert.notEqual((await db.query('select description from products where id=$1',[changed.products[0].id])).rows[0].description,changed.products[0].description);
  const broken=structuredClone(manifest);broken.products[0].variants[0].quantity=16;
  await assert.rejects(()=>apply(broken),/totalling 15/);
  await db.exec(await readFile('supabase/migrations/012_catalogue_inventory.sql','utf8'));
 }finally{await db.close();}
});
test('private costs, import authorization, MFA, inventory CAS and demo checkout protection',async()=>{
 const db=await catalogueDatabase();
 try{
  await db.query('insert into auth.users values($1),($2)',[a,b]);
  await db.query('insert into admin_members values($1)',[a]);
  await db.query("select set_config('request.uid',$1,false)",[a]);
  await db.exec("select set_config('request.aal','aal1',false);set role authenticated");
  await assert.rejects(()=>db.query('select import_store_catalogue($1::jsonb)',[JSON.stringify(manifest)]),/MFA/);
  await db.exec("select set_config('request.aal','aal2',false)");
  await db.query('select import_store_catalogue($1::jsonb,$2::jsonb)',[JSON.stringify(manifest),JSON.stringify([{catalogue_key:'ibuypower-ryzen-5-9500f',supplier_cost_cents:130000}])]);
  assert.equal((await db.query('select supplier_cost_cents from product_costs')).rows[0].supplier_cost_cents,130000);
  const variant=manifest.products[0].variants[0];
  await db.query('select adjust_inventory($1,$2,$3,$4)',[variant.id,variant.quantity,variant.quantity+1,'Count corrected in isolated test']);
  await assert.rejects(()=>db.query('select adjust_inventory($1,$2,$3,$4)',[variant.id,variant.quantity,0,'Stale overwrite attempt']),/changed/);
  await assert.rejects(()=>db.query('update inventory set quantity=0'),/permission denied/);
  assert.ok((await db.query('select * from inventory_adjustments')).rows.length>=113);
  await db.exec('reset role');await db.query("select set_config('request.uid',$1,false)",[b]);await db.exec("select set_config('request.aal','aal2',false);set role authenticated");
  assert.equal((await db.query('select * from product_costs')).rows.length,0);assert.equal((await db.query('select * from inventory_adjustments')).rows.length,0);
  await assert.rejects(()=>db.query('insert into product_costs(product_id,supplier_cost_cents) values($1,1)',[manifest.products[0].id]),/row-level/);
  await assert.rejects(()=>db.query('select adjust_inventory($1,1,0,$2)',[variant.id,'Customer attack']),/MFA/);
  await db.exec('reset role;set role anon');
  for(const table of ['products','product_variants','inventory'])assert.equal((await db.query('select count(*)::int n from '+table)).rows[0].n,0);
  const publicRows=(await db.query('select storefront_catalogue() as product')).rows.map(row=>row.product);
  assert.equal(publicRows.length,53);
  assert.equal(publicRows.flatMap(p=>p.variants).length,112);
  assert.equal(publicRows.filter(p=>p.variants.some(v=>v.image_path)).length,5);
  assert.ok(publicRows.every(p=>p.variants.every(v=>v.price_cents===null&&v.stock===null&&!('sku' in v))));
  assert.doesNotMatch(JSON.stringify(publicRows),/supplier_cost|demo_only|provisional|SKU origin|Price note/i);
  await assert.rejects(()=>db.query('select * from product_costs'),/permission denied/);
  await assert.rejects(()=>db.query('select import_store_catalogue($1::jsonb)',[JSON.stringify(manifest)]),/permission denied/);
  await db.exec('reset role');
  const p=manifest.products[0],v=p.variants[0];
  await db.exec('update store_settings set checkout_enabled=true,policies_approved=true');
  const ship=(await db.query("insert into shipping_rules(country,state,method,price_cents,tax_basis_points,approved,delivery_description) values('US','FL','Test',0,0,true,'Test only') returning id")).rows[0].id;
  // Even an accidentally activated demo variant cannot reserve an order.
  await db.query("update product_variants set image_path='images/products/test.webp',image_permission='approved',image_verified_at=now(),active=true where id=$1",[v.id]);
  await db.exec('set role authenticated');
  await assert.rejects(()=>db.query('select place_order($1,$2,$3,$4,$5)',[JSON.stringify([{variant_id:v.id,quantity:1}]),JSON.stringify({full_name:'Test',line1:'Test street',city:'Test',state:'FL',postal_code:'00000',country:'US',phone:'+12025550123'}),ship,'paypal','33333333-3333-4333-8333-333333333333']),/demo inventory/);
  assert.equal((await db.query('select count(*)::int n from orders')).rows[0].n,0);
  await db.exec('reset role');
  await db.query('update products set demo_only=false where id=$1',[p.id]);
  await db.exec('set role anon');
  const option=async()=>(await db.query('select storefront_catalogue() as product')).rows.find(row=>row.product.id===p.id).product.variants.find(x=>x.id===v.id);
  assert.equal((await option()).price_cents,null); // Provisional inventory is not purchase-ready.
  assert.equal((await option()).stock,null);
  await db.exec('reset role');
  await db.query('update inventory set provisional=false where variant_id=$1',[v.id]);
  await db.exec('set role anon');
  assert.equal((await option()).stock,v.quantity+1);
 }finally{await db.close();}
});
test('owner-approved prices preserve stock; signed-in reviews are moderated and delivered purchases verified',async()=>{
 const db=await catalogueDatabase();
 try {
  await db.query('select import_store_catalogue($1::jsonb)',[JSON.stringify(manifest)]);
  for(const name of ['reconcile-approved-inventory','apply-approved-product-media'])
   await db.exec(await readFile('supabase/setup/'+name+'.sql','utf8'));
  const stock=()=>db.query('select variant_id,quantity from inventory order by variant_id').then(result=>result.rows);
  const before=await stock();
  for(let i=0;i<2;i++)for(const name of ['confirm-current-store-inventory','update-iphone-specifications'])
   await db.exec(await readFile('supabase/setup/'+name+'.sql','utf8'));
  assert.deepEqual(await stock(),before);
  const phones=(await db.query("select product from storefront_catalogue() product where product->>'category'='Apple iPhones'")).rows.map(row=>row.product);
  assert.equal(phones.length,13);
  assert.ok(phones.every(p=>Object.keys(p.specifications).length>=18&&p.variants.every(v=>v.price_cents>0&&Number.isInteger(v.stock))));
  assert.equal(phones.filter(p=>p.variants.some(v=>v.active&&v.sku&&v.stock>0)).length,6);
  const iphone=phones.find(p=>p.name==='Apple iPhone 16');
  assert.equal(new Set(iphone.variants.map(v=>v.color)).size,5);
  assert.deepEqual([...new Set(iphone.variants.map(v=>v.price_cents))],[62900,72900]);
  assert.ok(iphone.variants.every(v=>v.image_path));
  await db.query('insert into auth.users values($1),($2)',[a,b]);
  await db.exec('update store_settings set checkout_enabled=true,policies_approved=true');
  const order=(await db.query(`insert into orders
    (user_id,request_id,shipping_address,method,status,payment_status,subtotal_cents,discount_cents,shipping_cents,tax_cents,total_cents)
    values($1,gen_random_uuid(),'{"full_name":"Test Buyer","line1":"1 Test Street","city":"Test","postal_code":"00000","state":"FL","country":"US","phone":"+12025550123"}','zelle','shipped','paid',62900,0,0,0,62900) returning id`,[a])).rows[0].id;
  await db.query(`insert into order_items
    (order_id,variant_id,product_id,product_name,sku,variant,quantity,unit_price_cents)
    values($1,$2,$3,'Apple iPhone 16',$4,'128GB',1,62900)`,[order,iphone.variants[0].id,iphone.id,iphone.variants[0].sku]);
  const submit=()=>db.query("select submit_review($1,5,'Product title','Review body in the isolated test','Test buyer')",[iphone.id]);
  const eligibility=()=>db.query('select review_eligibility($1) as state',[iphone.id]).then(result=>result.rows[0].state);
  await db.query("select set_config('request.uid',$1,false)",[a]);
  await db.exec('set role authenticated');
  assert.equal(await eligibility(),'eligible');
  // A signed-in non-purchaser may submit, but does not receive purchase verification.

  await db.exec('reset role');
  await db.query("update orders set status='delivered' where id=$1",[order]);
  await db.query("select set_config('request.uid',$1,false)",[b]);
  await db.exec('set role authenticated');
  assert.equal(await eligibility(),'eligible');
  await db.query("select set_config('request.uid',$1,false)",[a]);
  assert.equal(await eligibility(),'eligible');
  await submit();
  assert.equal(await eligibility(),'submitted');
  await assert.rejects(submit,/already reviewed/);
  assert.equal((await db.query('select approved from my_product_reviews()')).rows[0].approved,false);
  await assert.rejects(()=>db.query('select verified_order_id from reviews'),/permission denied/);
  await db.exec("reset role;select set_config('request.uid','',false);set role anon");
  assert.equal((await db.query('select title from reviews')).rows.length,0);
  await db.exec('reset role;update reviews set approved=true;set role anon');
  assert.deepEqual((await db.query('select title,verified_purchase from reviews')).rows,[{title:'Product title',verified_purchase:true}]);
 } finally {
  await db.close();
 }
});
