import {zelleConfiguration,screenshotBytes,cleanupUnreferencedEvidence} from '../_shared/zelle.ts';
import {readJsonBody,validateStoreRequest,RequestError} from '../_shared/http.ts';
import {service,checked,json,cors,identity,paypal,validateCapture,paypalConfiguration,sandboxPayPalEnabled} from '../_shared/server.ts';
Deno.serve(async(req:Request)=>{if(req.method==='OPTIONS')return new Response(null,{headers:cors});if(req.method!=='POST')return json({error:'Method not allowed'},405);if(req.headers.get('Origin')&&req.headers.get('Origin')!==cors['Access-Control-Allow-Origin'])return json({error:'Origin not allowed'},403);try{const body=await readJsonBody(req,2850000);validateStoreRequest(body);const {client,user}=await identity(req),admin=service();if(body.action==='payment_methods'){
 const launch=await checked(admin.from('store_settings').select('checkout_enabled,policies_approved,zelle_enabled,paypal_enabled').single());
 let zelle=false;try{zelleConfiguration();zelle=launch.zelle_enabled;}catch{}
 return json({zelle:launch.checkout_enabled&&launch.policies_approved&&zelle,paypal:false,cards:false});
}
if(body.action==='place_order'){
 if(body.method!=='zelle')throw new RequestError('Payment method temporarily unavailable',409);
 zelleConfiguration();
 const id=await checked(client.rpc('place_order',{p_items:body.items,p_address:body.address,p_shipping:body.shipping,p_method:body.method,p_request:body.request}));return json({id});
}
if(body.action==='zelle_evidence'){
 if(!await checked(client.rpc('is_admin')))throw new RequestError('Admin MFA required',403);
 const row=await checked(admin.from('orders').select('method,payments(zelle_evidence_path)').eq('id',body.id).single());
 if(row.method!=='zelle'||!row.payments?.zelle_evidence_path)throw new RequestError('Screenshot unavailable',404);
 const {signedUrl}=await checked(admin.storage.from('zelle-evidence').createSignedUrl(row.payments.zelle_evidence_path,60));
 return json({url:signedUrl});
}
const order=await checked(admin.from('orders').select('*,payments(*)').eq('id',body.id).eq('user_id',user.id).single());
if(body.action==='zelle_instructions'){
 const config=zelleConfiguration();
 const summary=await checked(admin.rpc('begin_zelle_payment',{p_id:order.id,p_user:user.id}));
 return json({...config,...summary,submitted:!!order.payments?.zelle_submitted_at,reference:order.payments?.reference||null});
}
if(body.action==='zelle_reference'){
 if(order.method!=='zelle'||order.stock_released||order.payment_status!=='processing')throw new RequestError('Payment submission unavailable',409);
 if(order.payments?.zelle_submitted_at){
  if(order.payments.reference===body.reference)return json({status:'payment_pending',submitted:true});
  throw new RequestError('Reference already submitted; contact support for corrections',409);
 }
 let path:string|null=null;
 if(body.screenshot){
  const file=screenshotBytes(body.screenshot);
  path=user.id+'/'+order.id+'/'+crypto.randomUUID()+'.'+file.extension;
  await checked(admin.storage.from('zelle-evidence').upload(path,file.bytes,{contentType:file.type,upsert:false}));
 }
 try{
  const result=await checked(admin.rpc('submit_zelle_payment',{p_id:order.id,p_user:user.id,p_reference:body.reference,p_evidence:path}));
  await cleanupUnreferencedEvidence(admin,order.id,path);return json(result);
 }catch(error){await cleanupUnreferencedEvidence(admin,order.id,path);throw error;}
}
throw new RequestError('PayPal is temporarily unavailable',409);
if(order.method!=='paypal'||order.stock_released||order.payment_status==='cancelled')throw new Error('Order not eligible for PayPal');if(body.action==='paypal_create'){if(['paid','refunded','partially_refunded'].includes(order.payment_status))throw new Error('Order already paid or refunded');if(new Date(order.expires_at)<=new Date())throw new Error('Reservation expired');if(order.payments.provider_order_id)return json({provider_id:order.payments.provider_order_id});const operationToken=crypto.randomUUID();const lease=await checked(admin.rpc('claim_payment_operation',{p_order:order.id,p_kind:'create',p_token:operationToken}));if(!lease?.claimed)throw new Error('Payment initialization processing; check order status before retrying');
const payment=await checked(admin.from('payments').select('provider_order_id').eq('order_id',order.id).single());
if(payment.provider_order_id){
  await checked(admin.rpc('finish_payment_operation',{p_order:order.id,p_kind:'create',p_token:operationToken}));
  return json({provider_id:payment.provider_order_id});
}
const remote=await paypal('/v2/checkout/orders',{intent:'CAPTURE',purchase_units:[{reference_id:order.id,custom_id:order.id,amount:{currency_code:order.currency,value:(order.total_cents/100).toFixed(2)},payee:{merchant_id:Deno.env.get('PAYPAL_MERCHANT_ID')},shipping:{name:{full_name:order.shipping_address.full_name},address:{address_line_1:order.shipping_address.line1,address_line_2:order.shipping_address.line2||'',admin_area_2:order.shipping_address.city,admin_area_1:order.shipping_address.state,postal_code:order.shipping_address.postal_code,country_code:order.shipping_address.country}}}],payment_source:{paypal:{experience_context:{shipping_preference:'SET_PROVIDED_ADDRESS',user_action:'PAY_NOW'}}}},order.id);await checked(admin.from('payments').update({provider_order_id:remote.id}).eq('order_id',order.id));await checked(admin.rpc('finish_payment_operation',{p_order:order.id,p_kind:'create',p_token:operationToken}));return json({provider_id:remote.id});}if(body.action==='paypal_reconcile'){if(['paid','refunded','partially_refunded'].includes(order.payment_status))return json({status:order.payment_status});if(!order.payments.provider_order_id)return json({status:order.payment_status});const remote=await paypal('/v2/checkout/orders/'+encodeURIComponent(order.payments.provider_order_id));if(remote.status!=='COMPLETED')return json({status:order.payment_status});const capture=validateCapture(order,remote);await checked(admin.rpc('confirm_payment',{p_id:order.id,p_capture:capture.id,p_amount:order.total_cents,p_currency:order.currency}));const latest=await checked(admin.from('orders').select('payment_status').eq('id',order.id).single());return json({status:latest.payment_status});}if(body.action==='paypal_capture'){if(['refunded','partially_refunded'].includes(order.payment_status))return json({status:order.payment_status});if(!order.payments.provider_order_id)throw new Error('Payment not initialized');let operationToken:string|undefined;
let remote=await paypal('/v2/checkout/orders/'+encodeURIComponent(order.payments.provider_order_id));if(remote.status!=='COMPLETED'){if(new Date(order.expires_at)<=new Date())throw new Error('Reservation expired; do not retry payment');operationToken=crypto.randomUUID();const lease=await checked(admin.rpc('claim_payment_operation',{p_order:order.id,p_kind:'capture',p_token:operationToken}));if(!lease?.claimed||lease.recovery_only)return json({status:'processing',message:'Payment outcome is being reconciled. Do not send another payment.'});await checked(admin.rpc('begin_capture',{p_id:order.id}));await paypal('/v2/checkout/orders/'+encodeURIComponent(order.payments.provider_order_id)+'/capture',{},order.id+'-capture');remote=await paypal('/v2/checkout/orders/'+encodeURIComponent(order.payments.provider_order_id));}
const capture=validateCapture(order,remote);
await checked(admin.rpc('confirm_payment',{p_id:order.id,p_capture:capture.id,p_amount:order.total_cents,p_currency:order.currency}));
if(operationToken)await checked(admin.rpc('finish_payment_operation',{p_order:order.id,p_kind:'capture',p_token:operationToken}));
const latest=await checked(admin.from('orders').select('payment_status').eq('id',order.id).single());return json({status:latest.payment_status});}throw new Error('Unsupported action');}catch(error){if(error instanceof RequestError)return json({error:error.message},error.status);const message=error instanceof Error?error.message:'Request failed';const safeMessage=/Authentication required|not configured|expired|Invalid|not eligible|already paid|unavailable|not initialized|Too many|unsupported|required|insufficient|Unknown|Duplicate|Complete/i.test(message)?message:'The request could not be completed. Check your order status before retrying.';return json({error:safeMessage},400);}});



