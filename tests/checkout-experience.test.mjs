import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {PHONE_COUNTRIES,normalizedPhone,phonePlaceholder,phoneFields} from '../js/checkout-phone.js';
import {zelleInstructions,zelleSuccess,filePayload} from '../js/zelle-checkout.js';

test('international phone parsing, local flag coverage and US default',async()=>{
 assert.ok(PHONE_COUNTRIES.length>230);
 for(const {code} of PHONE_COUNTRIES)await access(`node_modules/country-flag-icons/3x2/${code}.svg`);
 assert.equal(normalizedPhone('(202) 555-0123','US'),'+12025550123');
 assert.equal(normalizedPhone('07911 123456','GB'),'+447911123456');
 assert.equal(normalizedPhone('+92 300 1234567','US'),'+923001234567');
 assert.equal(normalizedPhone('211234','FO'),'+298211234');
 for(const input of ['123','call me at 2025550123','+','<script>','+12345678901234567890'])assert.equal(normalizedPhone(input),null);
 assert.match(phonePlaceholder('PK'),/^\+92/);assert.match(phoneFields(),/United States \+1/);
});
test('Zelle submission state removes payment form and escapes external references',async()=>{
 const result=zelleInstructions({id:'order-1'},{submitted:true,reference:'<script>alert(1)</script>'});
 assert.match(result,/Payment confirmation submitted/);assert.match(result,/awaiting bank verification/);
 assert.doesNotMatch(result,/<form|<script>|payment sent successfully|payment received/i);
 assert.match(result,/&lt;script&gt;/);assert.match(zelleSuccess('id','ref'),/View your orders/);
 const initial=zelleInstructions({id:'order-1'},{recipient:'owner@example.invalid',recipientName:'Local fixture',total_cents:12345});
 assert.match(initial,/\$123.45/);assert.match(initial,/data-copy-value="123.45"/);assert.match(initial,/<form/);
 await assert.rejects(()=>filePayload({size:2097153,type:'image/png'}),/2 MB/);
});
test('international contact migration is repeatable, preserves historical orders and enforces US delivery',async()=>{
 const db=new PGlite();try{
 await db.exec('create role anon;create role authenticated;create table orders(shipping_address jsonb);insert into orders values(\'{}\');');
 const sql=await readFile('supabase/migrations/028_international_contact.sql','utf8');await db.exec(sql);await db.exec('create trigger guard before insert on orders for each row execute function guard_order_address()');await db.exec(sql);
 const a={full_name:'Local fixture',line1:'Local fixture',city:'Local fixture',state:'HI',postal_code:'96801',country:'US',phone:'+298211234'};
 await db.query('insert into orders values($1)',[a]);
 for(const phone of ['123','abc1234567890','+0123456789','+1234567890123456'])await assert.rejects(()=>db.query('insert into orders values($1)',[{...a,phone}]),/Invalid/);
 await assert.rejects(()=>db.query('insert into orders values($1)',[{...a,country:'GB'}]),/Invalid/);
 await assert.rejects(()=>db.query('insert into orders values($1)',[{...a,state:'ON'}]),/Invalid/);
 assert.equal((await db.query('select count(*)::int n from orders')).rows[0].n,2);
 assert.equal((await db.query("select has_function_privilege('authenticated','guard_order_address()','execute') allowed")).rows[0].allowed,false);
 }finally{await db.close();}
});
