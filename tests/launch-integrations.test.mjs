import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transform} from 'esbuild';
const url=async source=>'data:text/javascript;base64,'+Buffer.from((await transform(source,{loader:'ts',format:'esm'})).code).toString('base64');
const id='11111111-1111-4111-8111-111111111111';
const request=body=>new Request('https://test.invalid',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer test-worker'},body:JSON.stringify(body)});

test('temporary sender self-test is private, synthetic, idempotent and never drains real order data',async()=>{
 const oldDeno=globalThis.Deno,oldFetch=globalThis.fetch;let handler;
 const env={EMAIL_WORKER_SECRET:'test-worker',RESEND_API_KEY:'test-only',EMAIL_TEST_RECIPIENT:'owner@example.test',EMAIL_MODE:'test'};
 const calls=[];
 globalThis.Deno={env:{get:k=>env[k]},serve:fn=>handler=fn};
 globalThis.fetch=async(u,o)=>{calls.push(JSON.parse(o.body));return Response.json({id:'test-message'});};
 try{
  const emailURL=await url(await readFile('supabase/functions/_shared/order-email.ts','utf8'));
  const httpURL=await url(await readFile('supabase/functions/_shared/http.ts','utf8'));
  let source=await readFile('supabase/functions/order-email/index.ts','utf8');
  source=source.replace("import {service} from '../_shared/server.ts';","const service=()=>{throw Error('Must not access real queue in test mode');};")
   .replace("from '../_shared/order-email.ts'",`from '${emailURL}'`).replace("from '../_shared/http.ts'",`from '${httpURL}'`);
  await import(await url(source));
  assert.equal((await handler(request({}))).status,503);assert.equal(calls.length,0);
  const health=await handler(request({action:'health'}));assert.equal(health.status,200);
  assert.deepEqual(await health.json(),{authenticated:true,resend_key_configured:true,mode:'test'});
  const preferred=env.EMAIL_WORKER_SECRET;delete env.EMAIL_WORKER_SECRET;env.ORDER_EMAIL_WORKER_SECRET=preferred;
  assert.equal((await handler(request({action:'health'}))).status,200);
  env.EMAIL_WORKER_SECRET='different-secret';assert.equal((await handler(request({action:'health'}))).status,401);
  env.EMAIL_WORKER_SECRET=preferred;delete env.ORDER_EMAIL_WORKER_SECRET;

  for(const kind of ['order_received','payment_submitted','payment_failed','payment_confirmed','processing','shipped','delivered','cancelled','refunded','partially_refunded']){
   for(const audience of ['customer','admin']){
    const result=await handler(request({action:'self_test',request_id:id,kind,audience}));
    assert.equal(result.status,200);assert.equal((await result.json()).inbox_delivery_verified,false);
   }
  }
  assert.equal(calls.length,20);
  assert.ok(calls.every(c=>c.from.includes('onboarding@resend.dev')&&c.to[0]==='owner@example.test'&&c.subject.startsWith('[TEST')&&!c.text.includes('Ship to:')));
  delete env.EMAIL_TEST_RECIPIENT;assert.equal((await handler(request({action:'self_test',request_id:id,kind:'shipped'}))).status,503);
  assert.equal(calls.length,20);
  globalThis.fetch=async()=>new Response(null,{status:403});
  env.EMAIL_TEST_RECIPIENT='owner@example.test';
  const rejected=await handler(request({action:'self_test',request_id:id,kind:'payment_confirmed'}));
  assert.equal(rejected.status,502);assert.deepEqual(await rejected.json(),{accepted:false,provider_status:403});
  const statusDenied=await handler(request({action:'test_status',provider_id:id}));
  assert.equal(statusDenied.status,502);assert.deepEqual(await statusDenied.json(),{accepted:false,provider_status:403});
  globalThis.fetch=async()=>Response.json({last_event:'delivered',to:['private@example.test'],text:'private content'});
  assert.deepEqual(await (await handler(request({action:'test_status',provider_id:id}))).json(),{provider_id:id,delivery_status:'delivered'});
  assert.equal((await handler(new Request('https://test.invalid',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'health'})}))).status,401);
 }finally{globalThis.Deno=oldDeno;globalThis.fetch=oldFetch;}
});

test('admin and customer notification retries have independent leases, acknowledgements and provider keys',async()=>{
 const {deliverOrderEmails}=await import(await url(await readFile('supabase/functions/_shared/order-email.ts','utf8')));
 const job={order_id:id,kind:'payment_submitted',recipient:'buyer@example.test',admin_recipient:'admin@example.test',payload:{order_id:id,total_cents:100,currency:'USD',items:[]}};
 const rpc=[],updates=[],sends=[];
 const db={rpc:async name=>{rpc.push(name);return {data:[job]};},from:()=>({update(v){updates.push(v);return this;},eq(){return this;},select(){return this;},single:async()=>({data:{order_id:id}})})};
 const send=async(u,o)=>{sends.push(o);return Response.json({id:'message'});};
 await deliverOrderEmails({db,key:'test',send});await deliverOrderEmails({db,key:'test',send,audience:'admin'});
 assert.deepEqual(rpc,['claim_order_emails','claim_admin_order_emails']);
 assert.ok(updates[0].sent_at&&!updates[0].admin_sent_at);assert.ok(updates[1].admin_sent_at&&!updates[1].sent_at);
 assert.notEqual(sends[0].headers['Idempotency-Key'],sends[1].headers['Idempotency-Key']);
 assert.equal(JSON.parse(sends[1].body).to[0],'admin@example.test');
 assert.match(JSON.parse(sends[1].body).text,/awaiting bank verification/);
});

test('PayPal Sandbox cannot activate against real store inventory or incomplete environment',async()=>{
 const prior=globalThis.Deno;
 const env={PAYPAL_ENV:'sandbox',PAYPAL_CLIENT_ID:'test-id',PAYPAL_CLIENT_SECRET:'test-secret',PAYPAL_MERCHANT_ID:'test-merchant',PAYPAL_WEBHOOK_ID:'test-webhook',PAYPAL_SANDBOX_ENABLED:'true',PAYPAL_SANDBOX_PROJECT_REF:'isolated-test',SUPABASE_URL:'https://isolated-test.supabase.co'};
 globalThis.Deno={env:{get:k=>env[k]}};
 try{
  const source=(await readFile('supabase/functions/_shared/server.ts','utf8')).replace(/^import .*\n/gm,'');
  const {sandboxPayPalEnabled}=await import(await url(source));
  assert.equal(sandboxPayPalEnabled(),true);
  for(const key of Object.keys(env)){
   const value=env[key];delete env[key];assert.equal(sandboxPayPalEnabled(),false,key);env[key]=value;
  }
  env.PAYPAL_ENV='live';assert.equal(sandboxPayPalEnabled(),false);env.PAYPAL_ENV='sandbox';
  env.PAYPAL_SANDBOX_PROJECT_REF='roamotmagssiipntchgh';env.SUPABASE_URL='https://roamotmagssiipntchgh.supabase.co';assert.equal(sandboxPayPalEnabled(),false);
 }finally{globalThis.Deno=prior;}
});

test('PayPal creation and capture remain disabled even with complete sandbox configuration (mock provider)',async()=>{
 const oldDeno=globalThis.Deno;const oldMock=globalThis.__launchPaymentMocks;
 const calls=[];let remoteStatus='APPROVED',outcome='success',leaseClaimed=false;
 const order={id,user_id:id,method:'paypal',stock_released:false,payment_status:'pending',expires_at:'2099-01-01',currency:'USD',total_cents:10000,payments:{provider_order_id:'remote-order'}};
 const httpURL=await url(await readFile('supabase/functions/_shared/http.ts','utf8'));
 const zelleURL=await url((await readFile('supabase/functions/_shared/zelle.ts','utf8')).replace("from './http.ts'",`from '${httpURL}'`));
 const db={from:()=>({select(){return this;},eq(){return this;},single:async()=>({data:order})}),rpc:async(name,args)=>{
  calls.push(name);
  if(name==='claim_payment_operation'){if(leaseClaimed)return {data:{claimed:false}};leaseClaimed=true;return {data:{claimed:true,recovery_only:false}};}
  if(name==='begin_capture')order.payment_status='processing';
  if(name==='confirm_payment')order.payment_status='paid';
  return {data:null};
 }};
 globalThis.__launchPaymentMocks={service:()=>db,checked:async p=>{const r=await p;if(r.error)throw r.error;return r.data;},json:(v,status=200)=>Response.json(v,{status}),cors:{'Access-Control-Allow-Origin':'https://test.invalid'},identity:async()=>({user:{id},client:db}),sandboxPayPalEnabled:()=>true,paypalConfiguration:()=>({id:'test'}),validateCapture:()=>({id:'verified-capture'}),paypal:async(path,body)=>{
  if(body){calls.push('provider_capture');if(outcome==='fail')throw Error('Payment provider request failed');remoteStatus='COMPLETED';}
  return {status:remoteStatus};
 }};
 globalThis.Deno={serve:()=>{}};
 try{
  let source=await readFile('supabase/functions/store-api/index.ts','utf8');
  source=source.replace("from '../_shared/http.ts'",`from '${httpURL}'`).replace("from '../_shared/zelle.ts'",`from '${zelleURL}'`)
   .replace(/import \{([^}]+)\} from '\.\.\/_shared\/server\.ts';/,(_,names)=>`const {${names}}=globalThis.__launchPaymentMocks;`).replace('Deno.serve(','export const handler=(');
  const {handler}=await import(await url(source));
  const capture=()=>handler(request({action:'paypal_capture',id}));
  for(const action of ['paypal_create','paypal_capture','paypal_reconcile']){
   const responses=await Promise.all([handler(request({action,id})),handler(request({action,id}))]);
   assert.ok(responses.every(r=>r.status===409));
  }
  assert.equal(order.payment_status,'pending');
  assert.deepEqual(calls,[]);
 }finally{globalThis.Deno=oldDeno;globalThis.__launchPaymentMocks=oldMock;}
});
