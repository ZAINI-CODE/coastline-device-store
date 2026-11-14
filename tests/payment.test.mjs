import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";
test("PayPal capture verification rejects wrong merchant, totals, currency, status and identity", async () => {
  const source = (await readFile("supabase/functions/_shared/server.ts", "utf8")).replace(/^import .*\n/gm, "");
  const code = (await transform(source, { loader: "ts", format: "esm", target: "es2022" })).code;
  const prior = globalThis.Deno;
  globalThis.Deno = { env: { get: (key) => key === "PAYPAL_MERCHANT_ID" ? "TEST-MERCHANT" : void 0 } };
  try {
    const { validateCapture } = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));
    const order = { id: "local-order", total_cents: 12345, currency: "USD", payments: { provider_order_id: "provider-order" } };
    const valid = { id: "provider-order", status: "COMPLETED", purchase_units: [{ reference_id: "local-order", payee: { merchant_id: "TEST-MERCHANT" }, payments: { captures: [{ id: "capture", status: "COMPLETED", amount: { currency_code: "USD", value: "123.45" } }] } }] };
    assert.equal(validateCapture(order, valid).id, "capture");
    const mutate = (fn) => {
      const r = structuredClone(valid);
      fn(r);
      return r;
    };
    for (const changed of [null, {}, mutate((r)=>delete r.purchase_units[0].payments.captures[0].id), mutate((r)=>r.purchase_units[0].payments.captures[0].id=' '), mutate((r)=>delete r.purchase_units[0].payments.captures[0].amount), mutate((r) => r.id = "other"), mutate((r) => r.status = "APPROVED"), mutate((r) => r.purchase_units[0].reference_id = "other"), mutate((r) => r.purchase_units[0].payee.merchant_id = "wrong"), mutate((r) => r.purchase_units[0].payments.captures[0].amount.value = "1.00"), mutate((r) => r.purchase_units[0].payments.captures[0].amount.currency_code = "EUR"), mutate((r) => r.purchase_units[0].payments.captures[0].status = "PENDING"), mutate((r) => r.purchase_units[0].payments.captures.push(r.purchase_units[0].payments.captures[0]))]) assert.throws(() => validateCapture(order, changed), /mismatch|failed/);
  } finally {
    globalThis.Deno = prior;
  }
});

test('PayPal requires complete explicit environment and preserves retry IDs (mock provider only)',async()=>{
  const source=(await readFile('supabase/functions/_shared/server.ts','utf8')).replace(/^import .*\n/gm,'');
  const code=(await transform(source,{loader:'ts',format:'esm',target:'es2022'})).code;
  const previousDeno=globalThis.Deno,previousFetch=globalThis.fetch;
  const env={PAYPAL_ENV:'sandbox',PAYPAL_CLIENT_ID:'test-client',PAYPAL_CLIENT_SECRET:'test-secret',PAYPAL_MERCHANT_ID:'test-merchant'};
  globalThis.Deno={env:{get:key=>env[key]}};
  const calls=[];
  globalThis.fetch=async(url,options)=>{
    calls.push({url,options});
    return new Response(JSON.stringify(url.endsWith('/token')?{access_token:'test-token'}:{id:'capture-1'}),{headers:{'Content-Type':'application/json'}});
  };
  try{
    const {paypal,paypalConfiguration}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
    for(const key of Object.keys(env)){
      const saved=env[key];delete env[key];
      assert.throws(()=>paypalConfiguration(),/not configured/);env[key]=saved;
    }
    env.PAYPAL_ENV='production';assert.throws(()=>paypalConfiguration(),/not configured/);env.PAYPAL_ENV='sandbox';
    await paypal('/v2/checkout/orders/test/capture',{},'stable-request');
    await paypal('/v2/checkout/orders/test/capture',{},'stable-request');
    assert.ok(calls.every(call=>call.url.startsWith('https://api-m.sandbox.paypal.com/')&&call.options.signal instanceof AbortSignal));
    assert.equal(calls[1].options.headers['PayPal-Request-Id'],'stable-request');
    assert.equal(calls[3].options.headers['PayPal-Request-Id'],'stable-request');
    globalThis.fetch=async()=>new Response('{}',{status:503});
    await assert.rejects(()=>paypal('/v2/checkout/orders/test'),/unavailable/);
  }finally{globalThis.Deno=previousDeno;globalThis.fetch=previousFetch;}
});
