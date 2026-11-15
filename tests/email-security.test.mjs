import {storageFixture} from './storage-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {transform} from 'esbuild';
import {PGlite} from '@electric-sql/pglite';
const url=async source=>'data:text/javascript;base64,'+Buffer.from((await transform(source,{loader:'ts',format:'esm'})).code).toString('base64');
const {orderEmail,deliverOrderEmails}=await import(await url(await readFile('supabase/functions/_shared/order-email.ts','utf8')));
const id='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const job={order_id:id,kind:'shipped',recipient:'fixture@example.test',payload:{order_id:id,total_cents:10000,currency:'USD',shipping_cents:0,carrier:'Fixture Carrier',tracking_number:'TRACK-TEST',shipping_address:{full_name:'Test <script>',line1:'Test street'},items:[{name:'Fixture phone',variant:'Black / 128GB',quantity:1,unit_price_cents:10000}]}};
test('branded email renders order snapshots safely and never calls pending payment paid',()=>{
 const email=orderEmail(job);for(const x of ['Fixture phone','Black / 128GB','TRACK-TEST','Fixture Carrier','$100.00'])assert.ok(email.text.includes(x));
 assert.ok(!email.html.includes('<script>'));assert.ok(email.html.includes('&lt;script&gt;'));
 const pending=orderEmail({...job,kind:'order_received'});assert.match(pending.text,/Payment is pending/);assert.doesNotMatch(pending.text,/We have verified/);
 assert.throws(()=>orderEmail({...job,payload:{...job.payload,tracking_number:null}}),/Shipping/);
});
test('email provider failure retries the same content/key without leaking private data or changing orders',async()=>{
 const calls=[],logs=[];let fail=true;
 const db={rpc:async()=>({data:[job]}),from:table=>{assert.equal(table,'order_email_outbox');return {update(value){calls.push(value);return this;},eq(){return this;},select(){return this;},single:async()=>({data:{order_id:id}})};}};
 const sends=[];const send=async(u,options)=>{sends.push(options);return fail?new Response('private provider detail',{status:503}):Response.json({id:'fixture-message'});};
 assert.deepEqual(await deliverOrderEmails({db,key:'LOCAL-TEST-KEY',send,log:(...x)=>logs.push(x)}),{claimed:1,sent:0,failed:1});
 fail=false;assert.equal((await deliverOrderEmails({db,key:'LOCAL-TEST-KEY',send,log:(...x)=>logs.push(x)})).sent,1);
 assert.equal(sends[0].headers['Idempotency-Key'],sends[1].headers['Idempotency-Key']);assert.equal(sends[0].body,sends[1].body);
 assert.doesNotMatch(JSON.stringify(logs),/fixture@example|Test street|LOCAL-TEST|private provider|11111111/);
 assert.equal(calls[0].last_error,'provider_503');assert.ok(calls[1].sent_at);
});
test('email worker rejects anonymous/wrong credentials and never opens the database',async()=>{
 const old=globalThis.Deno;let handler;
 globalThis.Deno={env:{get:k=>k==='ORDER_EMAIL_WORKER_SECRET'?'local-test-secret':undefined},serve:f=>handler=f};
 try{
  let source=await readFile('supabase/functions/order-email/index.ts','utf8');
  source=source.replace("import {service} from '../_shared/server.ts';","const service=()=>{throw new Error('Unauthorized privileged access');};");
  source=source.replace("import {deliverOrderEmails,orderEmail} from '../_shared/order-email.ts';","const deliverOrderEmails=()=>{throw new Error('Unexpected delivery');};const orderEmail=()=>{throw new Error('Unexpected test email');};");
  source=source.replace("import {readJsonBody,requireUUID} from '../_shared/http.ts';","const readJsonBody=()=>{throw new Error('Unexpected body');};const requireUUID=()=>{};");
  await import(await url(source));
  for(const authorization of ['', 'Bearer wrong'])assert.equal((await handler(new Request('https://test.invalid',{method:'POST',headers:{Authorization:authorization}}))).status,401);
  assert.equal((await handler(new Request('https://test.invalid',{method:'GET'}))).status,405);
  assert.equal((await handler(new Request('https://test.invalid',{method:'POST',headers:{Authorization:'Bearer local-test-secret'}}))).status,503);
 }finally{globalThis.Deno=old;}
});
test('accepted provider message is safely retried after database acknowledgement fails',async()=>{
 let acknowledge=false;const sends=[];
 const db={rpc:async()=>({data:[job]}),from:()=>({update(){return this;},eq(){return this;},select(){return this;},single:async()=>acknowledge?{data:{order_id:id}}:{error:{message:'write unavailable'}}})};
 const send=async(u,options)=>{sends.push(options);return Response.json({id:'same-provider-message'});};
 assert.equal((await deliverOrderEmails({db,key:'test',send,log:()=>{}})).failed,1);
 acknowledge=true;assert.equal((await deliverOrderEmails({db,key:'test',send,log:()=>{}})).sent,1);
 assert.equal(sends[0].body,sends[1].body);assert.equal(sends[0].headers['Idempotency-Key'],sends[1].headers['Idempotency-Key']);
});
test('evidence cleanup removes losing uploads but retains committed evidence and uncertain outcomes',async()=>{
 const httpURL=await url(await readFile('supabase/functions/_shared/http.ts','utf8'));
 const {cleanupUnreferencedEvidence}=await import(await url((await readFile('supabase/functions/_shared/zelle.ts','utf8')).replace("from './http.ts'",`from '${httpURL}'`)));
 const removed=[];let stored='winner.png',failed=false;
 const admin={from:()=>({select(){return this;},eq(){return this;},single:async()=>failed?{error:{message:'offline'}}:{data:{zelle_evidence_path:stored}}}),storage:{from:()=>({remove:async paths=>removed.push(...paths)})}};
 await cleanupUnreferencedEvidence(admin,id,'loser.png');assert.deepEqual(removed,['loser.png']);
 await cleanupUnreferencedEvidence(admin,id,'winner.png');failed=true;await cleanupUnreferencedEvidence(admin,id,'uncertain.png');assert.equal(removed.length,1);
});
test('latest SQL enforces two-customer isolation, MFA, complete purchases, durable email queue and replay safety (isolated PostgreSQL)',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.uid',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('aal',coalesce(current_setting('request.aal',true),'aal1'))$$;grant usage on schema public,auth to anon,authenticated,service_role;`);
  // The hosted audit found 018 missing. Verify 024 installs its compatible queue
  // without running the fresh-database installer or relying on 018.
  await storageFixture(db);
  for(const f of (await readdir('supabase/migrations')).filter(x=>/^\d.*\.sql$/.test(x)&&!x.startsWith('018_')).sort())await db.exec(await readFile('supabase/migrations/'+f,'utf8'));
  // Additive migrations may be repeated; do not duplicate queued jobs.
  for(const f of ['024_order_email_delivery.sql','025_purchase_validation.sql','026_order_notifications.sql','028_international_contact.sql','029_purchase_readiness.sql','030_customer_profiles.sql'])await db.exec(await readFile('supabase/migrations/'+f,'utf8'));
  await db.query('insert into auth.users values($1,$2),($3,$4)',[id,'buyer@example.test',other,'other@example.test']);
  await db.exec('update store_settings set checkout_enabled=true,policies_approved=true,zelle_enabled=true');
  const p=(await db.query("insert into products(name,brand,model,published,verification_source,verified_at) values('Fixture','Test','T',true,'https://example.test',now()) returning id")).rows[0].id;
  const v=(await db.query("insert into product_variants(product_id,sku,color,configuration,price_cents,active,price_source,price_verified_at) values($1,'LOCAL-SKU','Black','128GB',10000,true,'owner workbook',now()) returning id",[p])).rows[0].id;
  await db.query('insert into inventory(variant_id,quantity) values($1,3)',[v]);
  const shipping=(await db.query("insert into shipping_rules(country,state,method,price_cents,tax_basis_points,approved,delivery_description) values('US','FL','Fixture',0,0,true,'Test') returning id")).rows[0].id;
  await db.query("select set_config('request.uid',$1,false)",[id]);await db.exec('set role authenticated');
  const address={full_name:'Fixture Buyer',line1:'1 Fixture Street',city:'Fixture',state:'FL',country:'US',phone:'+12025550123',postal_code:'00000'};
  await db.query("insert into profiles(id,display_name) values($1,'Private buyer') on conflict(id) do update set display_name=excluded.display_name",[id]);
  await db.query("insert into customer_addresses(user_id,full_name,line1,city,state,postal_code,country)values($1,'Private buyer','1 Fixture Street','Fixture','FL','00000','US')",[id]);
  await db.query('insert into carts(user_id,items)values($1,$2)',[id,JSON.stringify([{variant_id:v,quantity:1}])]);
  const place=(a=address,key=crypto.randomUUID())=>db.query('select place_order($1::jsonb,$2::jsonb,$3,$4,$5) id',[JSON.stringify([{variant_id:v,quantity:1}]),JSON.stringify(a),shipping,'zelle',key]);
  await assert.rejects(()=>place({...address,full_name:undefined}),/address/i);
  await assert.rejects(()=>place({...address,postal_code:'abc'}),/address/i);
  await db.exec('reset role');await db.query('update inventory set provisional=true where variant_id=$1',[v]);await db.exec('set role authenticated');
  await assert.rejects(()=>place(),/configuration unavailable|Provisional/i);
  await db.exec('reset role');await db.query('update inventory set provisional=false where variant_id=$1',[v]);
  await db.query("update product_variants set configuration='pending' where id=$1",[v]);await db.exec('set role authenticated');
  await assert.rejects(()=>place(),/configuration unavailable/i);await db.exec('reset role');
  await db.query("update product_variants set configuration='128GB' where id=$1",[v]);await db.exec('set role authenticated');
  const key=crypto.randomUUID(),order=(await place(address,key)).rows[0].id;assert.equal((await place(address,key)).rows[0].id,order);
  await assert.rejects(()=>db.query("update orders set payment_status='paid' where id=$1",[order]),/permission/);
  await assert.rejects(()=>db.query('select * from order_email_outbox'),/permission/);
  await db.exec('reset role');assert.equal((await db.query('select quantity from inventory where variant_id=$1',[v])).rows[0].quantity,2);
  await db.query('select begin_zelle_payment($1,$2)',[order,id]);
  await db.query('select submit_zelle_payment($1,$2,$3,null)',[order,id,'LOCAL-REFERENCE']);
  await db.query('select submit_zelle_payment($1,$2,$3,null)',[order,id,'LOCAL-REFERENCE']);
  await db.query("select set_config('request.uid',$1,false)",[other]);await db.exec('set role authenticated');
  for(const table of ['profiles','customer_addresses','carts','orders','order_items','payments','order_status_history'])assert.equal((await db.query('select * from '+table)).rows.length,0);
  await assert.rejects(()=>db.query("insert into carts(user_id,items)values($1,'[]') on conflict(user_id) do update set items='[]'",[id]),/row-level security|permission/);
  await assert.rejects(()=>db.query('update inventory set quantity=999 where variant_id=$1',[v]),/permission/);
  await assert.rejects(()=>db.query('insert into admin_members values($1)',[other]),/row-level security|permission/);
  await assert.rejects(()=>db.query("select admin_order($1,'verify_zelle','LOCAL-TEST','')",[order]),/MFA/);
  await assert.rejects(()=>db.query('select claim_order_emails($1)',[id]),/permission/);
  await db.exec('reset role');await db.query('insert into admin_members values($1)',[id]);await db.query("select set_config('request.uid',$1,false)",[id]);
  await assert.rejects(()=>db.query("select admin_order($1,'verify_zelle','LOCAL-TEST','')",[order]),/MFA/);
  await db.exec("set request.aal='aal2';set role authenticated");
  await db.query("select admin_order($1,'verify_zelle','LOCAL-TEST','')",[order]);await db.query("select admin_order($1,'verify_zelle','LOCAL-TEST','')",[order]);
  await db.query("select admin_order($1,'processing','','')",[order]);await db.query("select admin_order($1,'shipped','TRACK-LOCAL','Fixture Carrier')",[order]);
  await db.exec('reset role;set role service_role');
  const jobs=(await db.query('select * from claim_order_emails($1)',[id])).rows;
  assert.deepEqual(jobs.map(x=>x.kind).sort(),['order_received','payment_confirmed','payment_submitted','processing','shipped']);
  const adminJobs=(await db.query('select * from claim_admin_order_emails($1)',[id])).rows;
  assert.equal(adminJobs.length,5);assert.ok(adminJobs.every(j=>j.admin_recipient==='fa-23-bscs-530@lgu.edu.pk'&&j.admin_attempts===1));
  assert.equal((await db.query('select * from claim_admin_order_emails($1)',[other])).rows.length,0);
  assert.equal(jobs[0].payload.items[0].name,'Fixture');assert.equal(jobs.find(x=>x.kind==='shipped').payload.tracking_number,'TRACK-LOCAL');
  assert.equal((await db.query('select * from claim_order_emails($1)',[other])).rows.length,0);
  await db.query("update order_email_outbox set next_attempt_at=now()-interval '1 minute'");
  const retry=(await db.query('select * from claim_order_emails($1)',[other])).rows;assert.equal(retry[0].attempts,2);assert.deepEqual(retry[0].payload,jobs.find(x=>x.kind===retry[0].kind).payload);
  await db.query("update order_email_outbox set first_attempt_at=now()-interval '24 hours',next_attempt_at=now()-interval '1 minute'");assert.equal((await db.query('select * from claim_order_emails($1)',[id])).rows.length,0);
  await db.exec('reset role;set role authenticated');
  await db.query("select admin_order($1,'delivered','','')",[order]);
  assert.equal((await db.query("select count(*)::int n from order_status_history where order_id=$1 and status='delivered'",[order])).rows[0].n,1);
  await db.exec('reset role');
  assert.equal((await db.query("select count(*)::int n from order_email_outbox where order_id=$1 and kind='delivered'",[order])).rows[0].n,1);
  assert.equal((await db.query('select count(*)::int n from orders')).rows[0].n,1);
 }finally{await db.close();}
});
