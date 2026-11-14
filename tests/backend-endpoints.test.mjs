import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transform} from 'esbuild';

const moduleURL = async source => 'data:text/javascript;base64,' + Buffer.from((await transform(source,{loader:'ts',format:'esm',target:'es2022'})).code).toString('base64');
const httpURL = await moduleURL(await readFile('supabase/functions/_shared/http.ts','utf8'));
const zelleURL=await moduleURL((await readFile('supabase/functions/_shared/zelle.ts','utf8')).replace("from './http.ts'","from '"+httpURL+"'"));
const {readJsonBody,validateStoreRequest,RequestError} = await import(httpURL);
const id='11111111-1111-4111-8111-111111111111';
const request=(body,headers={})=>new Request('https://local.invalid',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:typeof body==='string'?body:JSON.stringify(body)});

test('request parser bounds streamed UTF-8 bytes without trusting Content-Length',async()=>{
  assert.equal((await readJsonBody(request({reference:'test'}))).reference,'test');
  for(const body of ['null','[]','"text"','{'])await assert.rejects(()=>readJsonBody(request(body)),/JSON/);
  await assert.rejects(()=>readJsonBody(request({x:'💻'.repeat(7000)})),error=>error.status===413);
  await assert.rejects(()=>readJsonBody(request({x:'x'.repeat(26000)},{'Content-Length':'1'})),error=>error.status===413);
  await assert.rejects(()=>readJsonBody(request('{}',{'Content-Type':'text/plain'})),error=>error.status===415);
  let cancelled=false;
  const stream=new ReadableStream({pull(controller){controller.enqueue(new Uint8Array(13000));},cancel(){cancelled=true;}});
  await assert.rejects(()=>readJsonBody(new Request('https://local.invalid',{method:'POST',headers:{'Content-Type':'application/json'},body:stream,duplex:'half'})),error=>error.status===413);
  assert.equal(cancelled,true);
});

test('store input validation rejects invalid identities, actions and quantities before queries',()=>{
  const valid={action:'place_order',request:id,shipping:id,method:'paypal',items:[{variant_id:id,quantity:1}],address:{}};
  assert.doesNotThrow(()=>validateStoreRequest(valid));
  for(const change of [{action:'verify_payment'},{method:'card'},{request:'bad'},{shipping:'bad'},{items:[]},{items:[{variant_id:id,quantity:1.5}]},{items:[{variant_id:id,quantity:100}]},{address:[]}])assert.throws(()=>validateStoreRequest({...valid,...change}));
  assert.throws(()=>validateStoreRequest({action:'paypal_capture',id:'bad'}));
  assert.throws(()=>validateStoreRequest({action:'zelle_reference',id,reference:'   '}));
});

test('Edge handlers enforce authentication, MFA and verified PayPal state (isolated mocks)',async()=>{
  const prior=globalThis.__edgeMocks;
  const calls=[];
  const mocks={
    cors:{'Access-Control-Allow-Origin':'https://store.invalid'},
    json:(body,status=200)=>new Response(JSON.stringify(body),{status}),
    checked:async promise=>{const {data,error}=await promise;if(error)throw error;return data;},
    identity:async()=>{throw new RequestError('Authentication required',401);},
    service:()=>{throw new Error('Unexpected privileged database access');},
    paypalConfiguration:()=>({}),
    sandboxPayPalEnabled:()=>false,
    paypal:async()=>{throw new Error('Unexpected provider call');},
    validateCapture:()=>{throw new Error('Payment amount mismatch');}
  };
  globalThis.__edgeMocks=mocks;
  async function load(name){
    let source=await readFile(`supabase/functions/${name}/index.ts`,'utf8');
    source=source.replace(/from '\.\.\/_shared\/http\.ts'/g,`from '${httpURL}'`);
    source=source.replace("from '../_shared/zelle.ts'","from '"+zelleURL+"'");
    source=source.replace(/import \{([^}]+)\} from '\.\.\/_shared\/server\.ts';/,(_,names)=>`const {${names}}=globalThis.__edgeMocks;`);
    source=source.replace('Deno.serve(','export const handler=(');
    // Cache-bust because each load deliberately captures a different test dependency set.
    return (await import(await moduleURL(source+`\nexport const testModuleID=${Math.random()};`))).handler;
  }
  try{
    let store=await load('store-api');
    assert.equal((await store(new Request('https://local.invalid',{method:'GET'}))).status,405);
    assert.equal((await store(request({action:'paypal_capture',id},{Origin:'https://evil.invalid'}))).status,403);
    assert.equal((await store(request({action:'unknown',id}))).status,400);
    const unsigned=await store(request({action:'paypal_capture',id}));
    assert.equal(unsigned.status,401);
    assert.match((await unsigned.json()).error,/Authentication required/);

    mocks.identity=async()=>({user:{id:'customer-a'},client:{rpc:async()=>({data:false})}});
    let refund=await load('refund-order');
    assert.equal((await refund(request({id}))).status,403);
    assert.equal((await refund(request({id,bank_reference:'x'.repeat(201)}))).status,400);

    mocks.identity=async()=>({client:{rpc:async name=>({data:name==='is_admin'?true:id})}});
    mocks.service=()=>({from:table=>{
      assert.equal(table,'refunds');
      return {select(){return this;},eq(){return this;},single:async()=>({data:{id,status:'completed'}})};
    }});
    refund=await load('refund-order');
    assert.deepEqual(await (await refund(request({id,bank_reference:'verified-bank-reference'}))).json(),{status:'completed'});

    const order={id,user_id:'customer-a',method:'paypal',payment_status:'pending',stock_released:false,expires_at:'2099-01-01',currency:'USD',total_cents:10000,payments:{provider_order_id:'provider-1'}};
    mocks.identity=async()=>({user:{id:'customer-a'},client:{rpc:async()=>({data:false})}});
    mocks.service=()=>({from:table=>({select(){return this;},eq(key,value){calls.push([table,key,value]);return this;},single:async()=>({data:order})}),rpc:async(name,args)=>{calls.push([name,args]);return {data:null};}});
    mocks.paypal=async()=>({id:'provider-1',status:'COMPLETED'});
    store=await load('store-api');
    assert.equal((await store(request({action:'paypal_capture',id}))).status,409);
    assert.ok(calls.some(call=>call[1]==='user_id'&&call[2]==='customer-a'));
    assert.ok(!calls.some(call=>call[0]==='confirm_payment'));

    calls.length=0;
    mocks.validateCapture=()=>({id:'verified-capture'});
    store=await load('store-api');
    assert.equal((await store(request({action:'paypal_capture',id}))).status,409);
    assert.ok(!calls.some(call=>call[0]==='confirm_payment')); // Prepared provider remains disabled.

    calls.length=0;
    mocks.paypalConfiguration=()=>{throw new Error('PayPal is not configured');};
    store=await load('store-api');
    assert.equal((await store(request({action:'place_order',request:id,shipping:id,method:'paypal',items:[{variant_id:id,quantity:1}],address:{}}))).status,409);
    assert.equal(calls.length,0);

    const previousDeno=globalThis.Deno;
    globalThis.Deno={env:{get:key=>({ZELLE_RECIPIENT_EMAIL:'payments@example.test',ZELLE_RECIPIENT_NAME:'  Test Store  '})[key]}};
    try {
      const zelleOrder={...order,method:'zelle'};
      mocks.service=()=>({from:()=>({select(){return this;},eq(){return this;},single:async()=>({data:zelleOrder})}),rpc:async()=>new Date(zelleOrder.expires_at)<new Date()?{error:new Error('Reservation expired')}:{data:{id,total_cents:10000,currency:'USD',status:'payment_pending'}}});
      store=await load('store-api');
      const instructions=await store(request({action:'zelle_instructions',id}));
      assert.equal(instructions.status,200);
      assert.deepEqual(await instructions.json(),{recipient:'payments@example.test',recipientName:'Test Store',id,total_cents:10000,currency:'USD',status:'payment_pending',submitted:false,reference:null});
      zelleOrder.expires_at='2000-01-01';
      const expired=await store(request({action:'zelle_instructions',id}));
      assert.equal(expired.status,400);
      assert.doesNotMatch(await expired.text(),/payments@example\.test/);
    } finally {
      globalThis.Deno=previousDeno;
    }

    let webhook=await load('paypal-webhook');
    assert.equal((await webhook(request({id:'event-1',event_type:'PAYMENT.CAPTURE.COMPLETED'}))).status,401);
    assert.equal((await webhook(request({id:'',event_type:'PAYMENT.CAPTURE.COMPLETED'}))).status,400);
    const signatureHeaders=Object.fromEntries(['paypal-auth-algo','paypal-cert-url','paypal-transmission-id','paypal-transmission-sig','paypal-transmission-time'].map(name=>[name,'test-only']));
    const oldDeno=globalThis.Deno;
    globalThis.Deno={env:{get:()=> 'test-webhook-id'}};
    try{
      calls.length=0;
      mocks.paypal=async()=>({verification_status:'FAILURE'});
      webhook=await load('paypal-webhook');
      assert.equal((await webhook(request({id:'event-1',event_type:'PAYMENT.CAPTURE.COMPLETED'},signatureHeaders))).status,401);
      assert.equal(calls.length,0);
    }finally{globalThis.Deno=oldDeno;}
  }finally{globalThis.__edgeMocks=prior;}
});

test('identity checks the user with Auth before granting rate-limited server access (mock Auth)',async()=>{
  const oldDeno=globalThis.Deno,oldClient=globalThis.__identityTestClient;
  const calls=[];let verified=false;
  globalThis.Deno={env:{get:key=>key==='SITE_ORIGIN'?'https://store.invalid':'test-only'}};
  globalThis.__identityTestClient=(url,key,options)=>({
    auth:{getUser:async()=>{calls.push('auth');return verified?{data:{user:{id}},error:null}:{data:{user:null},error:{message:'Invalid JWT'}};}},
    rpc:async(name,args)=>{calls.push([name,args]);return {data:null,error:null};}
  });
  try{
    const source=(await readFile('supabase/functions/_shared/server.ts','utf8')).replace(/^import .*\n/,'const createClient=globalThis.__identityTestClient;\n').replace("from './http.ts'",`from '${httpURL}'`);
    const {identity}=await import(await moduleURL(source));
    await assert.rejects(()=>identity(request({})),/Authentication required/);
    await assert.rejects(()=>identity(request({}, {Authorization:'Bearer invalid-test-token'})),/Authentication required/);
    assert.deepEqual(calls,['auth']);
    verified=true;
    assert.equal((await identity(request({}, {Authorization:'Bearer verified-test-token'}))).user.id,id);
    assert.deepEqual(calls.at(-1),['limit_request',{p_user:id}]);
  }finally{globalThis.Deno=oldDeno;globalThis.__identityTestClient=oldClient;}
});
