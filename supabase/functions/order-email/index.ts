import {service} from '../_shared/server.ts';
import {deliverOrderEmails,orderEmail} from '../_shared/order-email.ts';
import {readJsonBody,requireUUID} from '../_shared/http.ts';
export async function matchesSecret(value:string,secret:string){
 const encode=(text:string)=>new TextEncoder().encode(text);
 const [a,b]=await Promise.all([value,secret].map(async x=>new Uint8Array(await crypto.subtle.digest('SHA-256',encode(x)))));
 let d=0;for(let i=0;i<b.length;i++)d|=a[i]^b[i];return d===0;
}
Deno.serve(async request=>{
 if(request.method!=='POST')return new Response(null,{status:405});
 const secret=Deno.env.get('EMAIL_WORKER_SECRET')||Deno.env.get('ORDER_EMAIL_WORKER_SECRET');
 if(!secret||!await matchesSecret(request.headers.get('Authorization')||'','Bearer '+secret))return new Response(null,{status:401});
 const key=Deno.env.get('RESEND_API_KEY');
 try{
  const body=await readJsonBody(request,2000);
  if(body.action==='health')return Response.json({authenticated:true,resend_key_configured:!!key,mode:Deno.env.get('EMAIL_MODE')==='live'?'live':'test'},{headers:{'Cache-Control':'no-store'}});
  if(!key)return new Response(null,{status:503});
  if(body.action==='test_status'){
   requireUUID(body.provider_id,'email ID');
   const response=await fetch('https://api.resend.com/emails/'+body.provider_id,{headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(10000)});
   if(!response.ok)return Response.json({accepted:false,provider_status:response.status},{status:502,headers:{'Cache-Control':'no-store'}});
   const result=await response.json();
   const statuses=['bounced','canceled','clicked','complained','delivered','delivery_delayed','failed','opened','queued','scheduled','sent','suppressed'];
   return Response.json({provider_id:body.provider_id,delivery_status:statuses.includes(result.last_event)?result.last_event:'unknown'},{headers:{'Cache-Control':'no-store'}});
  }
  // Test mail contains only synthetic content and never drains the real queue.
  if(body.action==='self_test'){
   requireUUID(body.request_id,'test request ID');
   const recipient=Deno.env.get('EMAIL_TEST_RECIPIENT');
   if(!recipient||! /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(recipient))return new Response(null,{status:503});
   const email=orderEmail({order_id:body.request_id,kind:body.kind,payload:{order_id:body.request_id,total_cents:100,currency:'USD',shipping_cents:0,carrier:'TEST CARRIER',tracking_number:'TEST-NOT-A-SHIPMENT',items:[{name:'Email delivery test (not an order)',variant:'Test configuration',quantity:1,unit_price_cents:100}]}},body.audience==='admin'?'admin':'customer');
   const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','Idempotency-Key':`self-test/${body.request_id}/${body.kind}/${body.audience==='admin'?'admin':'customer'}`},body:JSON.stringify({from:'Coastline Device Test <onboarding@resend.dev>',to:[recipient],...email,subject:'[TEST — NO REAL ORDER] '+email.subject}),signal:AbortSignal.timeout(10000)});
   if(!response.ok)return Response.json({accepted:false,provider_status:response.status},{status:502,headers:{'Cache-Control':'no-store'}});
   const result=await response.json();if(typeof result.id!=='string'||!result.id)return new Response(null,{status:502});
   return Response.json({accepted:true,provider_id:result.id,inbox_delivery_verified:false},{headers:{'Cache-Control':'no-store'}});
  }
  if(body.action&&body.action!=='deliver')return new Response(null,{status:400});
  // The owner does not yet own the custom domain. Never send customer data
  // using a pretend support sender or route real orders to a testing inbox.
  if(Deno.env.get('EMAIL_MODE')!=='live')return new Response(null,{status:503});
  const db=service();
  const customer=await deliverOrderEmails({db,key});
  const admin=await deliverOrderEmails({db,key,audience:'admin'});
  return Response.json({customer,admin},{headers:{'Cache-Control':'no-store'}});
 }
 catch{return new Response(null,{status:503});}
});
