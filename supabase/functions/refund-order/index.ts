import {readJsonBody,requireUUID,RequestError} from '../_shared/http.ts';
import {checked,cors,identity,json,paypal,service} from '../_shared/server.ts';

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response(null,{headers:cors});
  if(req.method!=='POST')return json({error:'Method not allowed'},405);
  if(req.headers.get('Origin')&&req.headers.get('Origin')!==cors['Access-Control-Allow-Origin'])return json({error:'Origin not allowed'},403);
  try{
    const body=await readJsonBody(req);
    requireUUID(body.id);
    if(body.bank_reference!==undefined && (typeof body.bank_reference!=='string'||body.bank_reference.length>200))throw new RequestError('Invalid bank reference');
    const {client}=await identity(req);
    if(!await checked(client.rpc('is_admin')))return json({error:'Admin MFA required'},403);
    const refundId=await checked(client.rpc('request_full_refund',{p_id:body.id,p_bank_reference:body.bank_reference||null}));
    const db=service();
    const readRefund=()=>checked(db.from('refunds').select('*').eq('id',refundId).single());
    const initialRefund=await readRefund();
    if(initialRefund.status==='completed')return json({status:'completed'});
    const order=await checked(db.from('orders').select('*,payments(*)').eq('id',body.id).single());
    if(order.method!=='paypal'||!order.payments.capture_id)throw new Error('Verified PayPal capture required');
    const operationToken=crypto.randomUUID();
    const lease=await checked(db.rpc('claim_payment_operation',{p_order:order.id,p_kind:'refund',p_token:operationToken}));
    if(!lease?.claimed)return json({status:'processing'});
    const refund=await readRefund();
    if(refund.status==='completed'){
      await checked(db.rpc('finish_payment_operation',{p_order:order.id,p_kind:'refund',p_token:operationToken}));
      return json({status:'completed'});
    }
    const remote=refund.provider_refund_id
      ?await paypal('/v2/payments/refunds/'+encodeURIComponent(refund.provider_refund_id))
      :await paypal('/v2/payments/captures/'+encodeURIComponent(order.payments.capture_id)+'/refund',{
        amount:{value:(refund.amount_cents/100).toFixed(2),currency_code:refund.currency},
        note_to_payer:'Refund for order '+order.id
      },refund.id);
    if(!['PENDING','COMPLETED'].includes(remote.status)||!remote.id||remote.amount?.currency_code!==refund.currency||remote.amount?.value!==(refund.amount_cents/100).toFixed(2))throw new Error('Refund verification failed');
    await checked(db.rpc('finish_paypal_refund',{p_refund:refund.id,p_provider_id:remote.id,p_amount:refund.amount_cents,p_currency:refund.currency,p_completed:remote.status==='COMPLETED'}));
    await checked(db.rpc('finish_payment_operation',{p_order:order.id,p_kind:'refund',p_token:operationToken}));
    return json({status:remote.status.toLowerCase()});
  }catch(error){if(error instanceof RequestError)return json({error:error.message},error.status);return json({error:'Refund could not be confirmed. Reconcile the provider record before retrying; the same refund request is reused.'},400);}
});
