const escape = (s:unknown) => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function orderEmail(job:any,audience='customer'){
 const p=job.payload||job;
 const titles:Record<string,string>={order_received:'We received your order',payment_submitted:'Your payment reference was received',payment_failed:'Your payment was not completed',payment_confirmed:'Your payment is confirmed',processing:'Your order is being prepared',shipped:'Your order has shipped',delivered:'Your order is delivered',cancelled:'Your order was cancelled',refunded:'Your refund was recorded',partially_refunded:'Your partial refund was recorded'};
 if(!titles[job.kind]||p.order_id!==job.order_id||!Number.isSafeInteger(p.total_cents)||p.total_cents<=0||p.currency!=='USD')throw new Error('Invalid email payload');
 if(job.kind==='shipped'&&(!p.carrier||!p.tracking_number))throw new Error('Shipping information missing');
 const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n/100);
 const lines=[titles[job.kind],`Order: ${job.order_id}`];
 if(job.kind==='order_received')lines.push('Payment is pending until verified. This order-receipt email does not confirm receipt of funds. Check your account for the current payment status and instructions.');
 if(job.kind==='payment_confirmed')lines.push('We have verified receipt of your payment.');
 if(job.kind==='payment_submitted')lines.push('Your reference is awaiting bank verification. Do not send another payment. A submitted reference or screenshot does not confirm receipt of funds.');
 if(job.kind==='payment_failed')lines.push('Check the order in your account before attempting payment again. Contact support if your bank shows a debit.');
 if(audience==='admin')lines.unshift('Store admin notification — review this order in the MFA-protected dashboard.');
 for(const i of p.items||[])lines.push(`${i.name} — ${i.variant} | ${i.quantity} × ${money(i.unit_price_cents)}${i.discount_cents?` | line savings ${money(i.discount_cents)}`:''}`);
 lines.push(`Order total: ${money(p.total_cents)}`,`Shipping: ${money(p.shipping_cents||0)}`);
 const a=p.shipping_address;
 if(a)lines.push('Ship to: '+[a.full_name,a.line1,a.line2,a.city,a.state,a.postal_code,a.country].filter(Boolean).join(', '));
 if(p.carrier&&p.tracking_number)lines.push(`Carrier: ${p.carrier}`,`Tracking number: ${p.tracking_number}`);
 lines.push('Questions? Contact support@coastlinedevice.com.','Coastline Device — Modern technology. Reliable shopping.');
 return {subject:`Coastline Device${audience==='admin'?' Admin':''} — ${titles[job.kind]}`,text:lines.join('\n\n'),html:`<!doctype html><html><body style="font-family:Arial,sans-serif;color:#182b34;background:#f5f6f4;padding:24px"><main style="max-width:620px;margin:auto;background:white;padding:28px"><h1 style="font-size:24px">Coastline Device</h1>${lines.map((line,index)=>index===0?`<h2>${escape(line)}</h2>`:`<p style="line-height:1.6">${escape(line)}</p>`).join('')}</main></body></html>`};
}
export async function deliverOrderEmails({db,key,from='Coastline Device Co. <support@coastlinedevice.com>',audience='customer',send=fetch,log=console.error}:any){
 if(!['customer','admin'].includes(audience))throw new Error('Invalid email audience');
 const prefix=audience==='admin'?'admin_':'';
 const token=crypto.randomUUID();
 const {data:jobs,error}=await db.rpc(audience==='admin'?'claim_admin_order_emails':'claim_order_emails',{p_token:token});
 if(error)throw new Error('Email queue unavailable');
 let sent=0,failed=0;
 for(const job of jobs||[]){
  try{
   const email=orderEmail(job,audience);
   const response=await send('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','Idempotency-Key':`order/${job.order_id}/${job.kind}${audience==='admin'?'/admin':''}`},body:JSON.stringify({from,to:[audience==='admin'?job.admin_recipient:job.recipient],...email}),signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw new Error('provider_'+response.status);
   const body=await response.json();if(typeof body.id!=='string'||!body.id)throw new Error('provider_response');
   const result=await db.from('order_email_outbox').update({[prefix+'provider_id']:body.id,[prefix+'sent_at']:new Date().toISOString(),[prefix+'lease_token']:null,[prefix+'last_error']:null}).eq('order_id',job.order_id).eq('kind',job.kind).eq(prefix+'lease_token',token).select('order_id').single();
   if(result.error||!result.data)throw new Error('delivery_record');
   sent++;
  }catch(error){
   failed++;
   const code=error instanceof Error&&/^provider_\d{3}$/.test(error.message)?error.message:'delivery_retry_required';
   // Do not log recipient, address, order content, response body or credentials.
   log('Order email delivery failed',code);
   try{await db.from('order_email_outbox').update({[prefix+'last_error']:code}).eq('order_id',job.order_id).eq('kind',job.kind).eq(prefix+'lease_token',token);}catch{}
  }
 }
 return {claimed:jobs?.length||0,sent,failed};
}
