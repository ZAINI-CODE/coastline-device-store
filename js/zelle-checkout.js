import {escapeHTML as e,money} from './core.js';
import {invoke} from './api.js';
export function zelleForm(id){
 return `<form class="zelle-submission" data-order="${e(id)}"><h3>Submit payment confirmation</h3><label>Zelle transaction reference<input name="reference" required minlength="3" maxlength="200" autocomplete="off"></label><label>Payment screenshot (optional)<input name="screenshot" type="file" accept="image/jpeg,image/png,image/webp"></label><p>JPG, PNG or WebP, up to 2 MB. Hide unrelated account information. A screenshot is supporting information only.</p><button class="button">Submit payment confirmation</button><p class="zelle-result" role="status"></p></form>`;
}
export function zelleInstructions(order,result){
 return `<h3>Zelle payment instructions</h3><p><strong>Payment Pending</strong> — awaiting receipt and manual verification.</p><dl><dt>Order number</dt><dd>${e(order.id)}</dd><dt>Exact amount (USD)</dt><dd>${money(result.total_cents)}</dd><dt>Recipient name</dt><dd>${e(result.recipientName)}</dd><dt>Enrolled Zelle email</dt><dd>${e(result.recipient)}</dd></dl><ol><li>Open Zelle in your bank’s app and verify the recipient name and email shown above.</li><li>Send the exact amount once. Include order ${e(order.id)} in the payment memo if your bank permits.</li><li>Submit your bank’s transaction reference below. Do not send another payment while verification is pending.</li></ol><p>We begin order processing only after checking actual receipt in the business bank account. If a transfer is delayed or uncertain, contact support@coastlinedevice.com before retrying. Your items remain reserved during manual reconciliation.</p>${result.submitted?`<p>Confirmation received. Reference: ${e(result.reference)}. Payment is still pending bank verification.</p>`:zelleForm(order.id)}`;
}
export async function filePayload(file){
 if(!file?.size)return undefined;
 if(file.size>2097152||!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Use a JPG, PNG or WebP screenshot up to 2 MB.');
 const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('Screenshot could not be read.'));reader.readAsDataURL(file);});
 return {type:file.type,base64};
}
export function wireZelleForms(root=document){
 root.querySelectorAll('.zelle-submission').forEach(form=>form.onsubmit=async event=>{
  event.preventDefault();const button=form.querySelector('button'),status=form.querySelector('[role=status]');button.disabled=true;
  try{
   const data=new FormData(form),screenshot=await filePayload(data.get('screenshot'));
   await invoke('zelle_reference',{id:form.dataset.order,reference:String(data.get('reference')||'').trim(),...(screenshot?{screenshot}:{})});
   status.textContent='Confirmation received. Payment Pending — our team will verify actual bank receipt. Do not pay again.';
   [...form.elements].forEach(el=>el.disabled=true);
  }catch(error){status.textContent=error.message;button.disabled=false;}
 });
}
