import {escapeHTML as e,money} from './core.js';
import {invoke} from './api.js';
import {interfaceIcon} from './interface-icons.js';
export function zelleSuccess(id,reference){
 return `<section class="payment-submitted" aria-live="polite"><span class="payment-check">${interfaceIcon('check')}</span><h2 tabindex="-1">Payment confirmation submitted</h2><p>Your reference has reached our team. Your payment is awaiting bank verification.</p><p>We’ll update your order after verifying receipt of funds. Please do not send another payment.</p><dl><dt>Order number</dt><dd>${e(id)}</dd><dt>Transaction reference</dt><dd>${e(reference)}</dd></dl><a class="button" href="#/account">View your orders ${interfaceIcon('arrow')}</a></section>`;
}
export function zelleForm(id){
 return `<form class="zelle-submission" data-order="${e(id)}"><h3>Submit payment confirmation</h3><label>Zelle transaction reference<input name="reference" required minlength="3" maxlength="200" autocomplete="off"></label><label>Payment screenshot (optional)<input name="screenshot" type="file" accept="image/jpeg,image/png,image/webp"></label><p>JPG, PNG or WebP, up to 2 MB. Hide unrelated account information. A screenshot is supporting information only.</p><button class="button">Submit payment confirmation</button><p class="zelle-result" role="status"></p></form>`;
}
export function zelleInstructions(order,result){
 if(result.submitted)return zelleSuccess(order.id,result.reference);
 const row=(label,value,copy=value)=>`<div><dt>${label}</dt><dd><span>${e(value)}</span><button type="button" class="copy-payment" data-copy-value="${e(copy)}" aria-label="Copy ${label.toLowerCase()}">${interfaceIcon('copy')}</button></dd></div>`;
 return `<div class="zelle-instructions"><h2>${interfaceIcon('phone')} Pay with Zelle</h2><p class="payment-pending">Payment Pending · bank verification required</p><dl class="payment-recipient">${row('Order number',order.id)}${row('Exact amount (USD)',money(result.total_cents),(result.total_cents/100).toFixed(2))}${row('Recipient name',result.recipientName)}${row('Enrolled Zelle email',result.recipient)}</dl><ol><li>Open your bank’s app and choose Zelle. Check the recipient name and email above before sending.</li><li>Send the exact amount once. Include your order number in the memo if your bank permits.</li><li>Return here and submit your bank’s transaction reference.</li></ol><a class="text-link" href="https://www.zelle.com/get-started" target="_blank" rel="noopener noreferrer">Find your bank ${interfaceIcon('arrow')}</a><p>We process your order after verifying actual bank receipt. A screenshot alone does not confirm payment.</p><p class="copy-result" role="status"></p>${zelleForm(order.id)}</div>`;
}
export async function filePayload(file){
 if(!file?.size)return undefined;
 if(file.size>2097152||!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Use a JPG, PNG or WebP screenshot up to 2 MB.');
 const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('Screenshot could not be read.'));reader.readAsDataURL(file);});
 return {type:file.type,base64};
}
export function wireZelleForms(root=document,submit=invoke){
 root.querySelectorAll('[data-copy-value]').forEach(button=>button.onclick=async()=>{const status=root.querySelector('.copy-result');try{await navigator.clipboard.writeText(button.dataset.copyValue);status.textContent='Copied.';}catch{status.textContent='Copy is unavailable. Please select and copy the details above.';}});
 root.querySelectorAll('.zelle-submission').forEach(form=>form.onsubmit=async event=>{
  event.preventDefault();const button=form.querySelector('button'),status=form.querySelector('[role=status]');button.disabled=true;
  try{
   const data=new FormData(form),screenshot=await filePayload(data.get('screenshot'));
   const reference=String(data.get('reference')||'').trim();
   await submit('zelle_reference',{id:form.dataset.order,reference,...(screenshot?{screenshot}:{})});
   const panel=form.closest('#payment')||form.closest('.zelle-instructions')||form.parentElement;
   panel.innerHTML=zelleSuccess(form.dataset.order,reference);
   const heading=panel.querySelector('h2');heading.focus({preventScroll:true});panel.scrollIntoView({block:'start',behavior:'auto'});
  }catch(error){status.textContent=error.message;button.disabled=false;}
 });
}
