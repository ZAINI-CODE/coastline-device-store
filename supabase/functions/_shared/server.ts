import {createClient} from 'npm:@supabase/supabase-js@2.81.1';
import {RequestError} from './http.ts';
export const service = () => createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
export const checked = async (promise:any) => {const {data,error}=await promise;if(error)throw new Error(error.message);return data;};
export const cors = {'Access-Control-Allow-Origin':Deno.env.get('SITE_ORIGIN')||'http://localhost:4173','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
export function json(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});}
export async function identity(req:Request){const authorization=req.headers.get('Authorization');if(!authorization?.startsWith('Bearer '))throw new RequestError('Authentication required',401);const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});const {data:{user},error}=await client.auth.getUser();if(error||!user)throw new RequestError('Authentication required',401);await checked(service().rpc('limit_request',{p_user:user.id}));return {client,user};}
export function paypalConfiguration(){
 const env=Deno.env.get('PAYPAL_ENV');
 const id=Deno.env.get('PAYPAL_CLIENT_ID'),secret=Deno.env.get('PAYPAL_CLIENT_SECRET'),merchant=Deno.env.get('PAYPAL_MERCHANT_ID');
 if(!['sandbox','live'].includes(env||'')||[id,secret,merchant].some(value=>!value?.trim()||value.includes('PLACEHOLDER')))throw new Error('PayPal is not configured');
 return {id:id!,secret:secret!,merchant:merchant!,base:env==='live'?'https://api-m.paypal.com':'https://api-m.sandbox.paypal.com'};
}
export function sandboxPayPalEnabled(){
 // Sandbox orders must never consume real storefront inventory. Require a
 // separately configured test project, with its own catalogue and users.
 const ref=Deno.env.get('PAYPAL_SANDBOX_PROJECT_REF');
 if(Deno.env.get('PAYPAL_SANDBOX_ENABLED')!=='true'||!ref||ref==='roamotmagssiipntchgh'||
 Deno.env.get('SUPABASE_URL')!==`https://${ref}.supabase.co`)return false;
 const webhook=Deno.env.get('PAYPAL_WEBHOOK_ID');
 try{return Deno.env.get('PAYPAL_ENV')==='sandbox'&&!!paypalConfiguration()&&!!webhook?.trim()&&!webhook.includes('PLACEHOLDER');}catch{return false;}
}
export async function paypal(path:string,body?:unknown,requestId?:string){const {id,secret,base}=paypalConfiguration();const auth=await fetch(base+'/v1/oauth2/token',{method:'POST',signal:AbortSignal.timeout(15000),headers:{Authorization:'Basic '+btoa(id+':'+secret),'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials'});if(!auth.ok)throw new Error('Payment provider unavailable');const {access_token}=await auth.json();if(typeof access_token!=='string'||!access_token)throw new Error('Payment provider unavailable');const response=await fetch(base+path,{signal:AbortSignal.timeout(20000),method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+access_token,'Content-Type':'application/json',...(requestId?{'PayPal-Request-Id':requestId}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});if(!response.ok)throw new Error('Payment provider request failed; check order status before retrying');return response.json();}
export function validateCapture(order:any,remote:any){
 const units=remote?.purchase_units;
 if(!order?.id||!order.payments?.provider_order_id||!Number.isSafeInteger(order.total_cents)||order.total_cents<=0||order.currency!=='USD'||remote?.id!==order.payments.provider_order_id||remote.status!=='COMPLETED'||!Array.isArray(units)||units.length!==1)throw new Error('Payment verification failed');
 const unit=units[0],captures=unit?.payments?.captures;
 if(unit?.reference_id!==order.id||unit?.payee?.merchant_id!==Deno.env.get('PAYPAL_MERCHANT_ID')||!Deno.env.get('PAYPAL_MERCHANT_ID')||!Array.isArray(captures)||captures.length!==1)throw new Error('Payment identity mismatch');
 const capture=captures[0];
 if(typeof capture?.id!=='string'||!capture.id.trim()||capture.id.length>200||capture.status!=='COMPLETED'||capture.amount?.currency_code!==order.currency||capture.amount?.value!==(order.total_cents/100).toFixed(2))throw new Error('Payment amount mismatch');
 return capture;
}
