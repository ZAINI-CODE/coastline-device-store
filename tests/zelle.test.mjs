import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transform} from 'esbuild';
import {PGlite} from '@electric-sql/pglite';
async function catalogueDatabase(){
 const db=new PGlite();
 await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.uid',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('aal',coalesce(current_setting('request.aal',true),'aal1'))$$;grant usage on schema public,auth to anon,authenticated,service_role;grant execute on all functions in schema auth to anon,authenticated,service_role;");
 for(const file of ['001_store.sql','002_hardening.sql','003_checkout_guards.sql','007_payment_replay_guards.sql','023_zelle_checkout.sql'])await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
 return db;
}
test('Zelle holds survive expiry, submission is idempotent, bank confirmation requires MFA and payment IDs remain unique (isolated database)',async()=>{
 const db=await catalogueDatabase(),buyer='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
 try{
  await db.exec(`insert into auth.users values('${buyer}'),('${other}');insert into admin_members values('${buyer}');
   update store_settings set checkout_enabled=true,policies_approved=true,zelle_enabled=true,paypal_enabled=false;
   insert into orders(id,user_id,request_id,shipping_address,method,subtotal_cents,discount_cents,shipping_cents,tax_cents,total_cents)
   values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','${buyer}',gen_random_uuid(),'{"full_name":"Local fixture","line1":"Local fixture","city":"Local fixture","postal_code":"00000"}','zelle',10000,0,0,0,10000);
   insert into payments(order_id) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');`);
  const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  await assert.rejects(()=>db.query('select begin_zelle_payment($1,$2)',[id,other]),/unavailable/);
  await db.query('select begin_zelle_payment($1,$2)',[id,buyer]);
  await db.query("update orders set expires_at=now()-interval '1 hour' where id=$1",[id]);
  await db.query('select expire_reservations()');
  assert.equal((await db.query('select stock_released from orders where id=$1',[id])).rows[0].stock_released,false);
  await db.query('select submit_zelle_payment($1,$2,$3,null)',[id,buyer,'LOCAL-ONLY-REFERENCE']);
  await db.query('select submit_zelle_payment($1,$2,$3,null)',[id,buyer,'LOCAL-ONLY-REFERENCE']);
  await assert.rejects(()=>db.query('select submit_zelle_payment($1,$2,$3,null)',[id,buyer,'CHANGED']),/already submitted/);
  assert.equal((await db.query('select payment_status from orders where id=$1',[id])).rows[0].payment_status,'processing');
  await db.query("select set_config('request.uid',$1,false)",[buyer]);
  await assert.rejects(()=>db.query("select admin_order($1,'verify_zelle','LOCAL-BANK-FIXTURE','')",[id]),/MFA/);
  await db.exec("set role authenticated");
  await assert.rejects(()=>db.query('select submit_zelle_payment($1,$2,$3,null)',[id,buyer,'ATTACK']),/permission denied/);
  await db.exec('reset role');
  await db.exec("set request.aal='aal2'");
  await db.query("select admin_order($1,'verify_zelle','LOCAL-BANK-FIXTURE','')",[id]);
  await db.query("select admin_order($1,'verify_zelle','LOCAL-BANK-FIXTURE','')",[id]);
  assert.equal((await db.query('select payment_status from orders where id=$1',[id])).rows[0].payment_status,'paid');
  await assert.rejects(()=>db.query('select cancel_unreceived_zelle($1,$2)',[id,'Local bank check only']),/Unpaid/);
  assert.equal((await db.query("select count(*)::int n from admin_audit_logs where action='payment_verified' and record_id=$1",[id])).rows[0].n,1);
  await db.exec(await readFile('supabase/migrations/023_zelle_checkout.sql','utf8')); // repeatable
 }finally{await db.close();}
});
test('Screenshot validation rejects oversized, executable and mismatched content',async()=>{
 const http=(await transform(await readFile('supabase/functions/_shared/http.ts','utf8'),{loader:'ts',format:'esm'})).code;
 const url='data:text/javascript;base64,'+Buffer.from(http).toString('base64');
 const source=(await readFile('supabase/functions/_shared/zelle.ts','utf8')).replace("from './http.ts'",`from '${url}'`);
 const {screenshotBytes}=await import('data:text/javascript;base64,'+Buffer.from((await transform(source,{loader:'ts',format:'esm'})).code).toString('base64'));
 assert.throws(()=>screenshotBytes({type:'image/svg+xml',base64:btoa('<script>bad</script>')}));
 assert.throws(()=>screenshotBytes({type:'image/png',base64:btoa('<script>bad</script>')}));
 assert.throws(()=>screenshotBytes({type:'image/png',base64:'a'.repeat(2796208)}));
 const png=Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]);
 assert.equal(screenshotBytes({type:'image/png',base64:png.toString('base64')}).extension,'png');
});
