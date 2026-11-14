import {escapeHTML as e} from './core.js';

export function purchaseLimit(product,variant){
 if(!product||product.review_only||product.demo_only||!variant||variant.provisional||variant.active===false||!Number.isInteger(variant.stock)||variant.stock<1||!Number.isInteger(variant.price_cents)||variant.price_cents<=0)return 0;
 const limits=[99,variant.stock];
 for(const n of [product.purchase_limit,variant.purchase_limit,product.max_per_order,variant.max_per_order])if(Number.isInteger(n)&&n>=0)limits.push(n);
 return Math.max(0,Math.min(...limits));
}
export function remainingQuantity(product,variant,cart=[]){return Math.max(0,purchaseLimit(product,variant)-cart.filter(x=>x.variant_id===variant?.id).reduce((n,x)=>n+x.quantity,0));}
export function quantityStepper(value=1,id='quantity',label='Quantity'){
 return `<div class="quantity-field"><label for="${e(id)}">${e(label)}</label><div class="quantity-stepper"><button type="button" data-quantity-step="-1" aria-label="Decrease ${e(label.toLowerCase())}">−</button><input id="${e(id)}" type="number" inputmode="numeric" value="${value}" min="1" max="99" aria-describedby="${e(id)}-limit"><button type="button" data-quantity-step="1" aria-label="Increase ${e(label.toLowerCase())}">+</button></div><small id="${e(id)}-limit" class="quantity-limit"></small></div>`;
}
export function wireStepper(root,{max=()=>99,onChange=()=>{}}={}){
 const input=root.querySelector('input');
 function sync(){const limit=max();input.max=String(Math.max(1,limit));input.disabled=limit<1;input.value=String(Math.min(Math.max(1,Number.isInteger(Number(input.value))?Number(input.value):1),Math.max(1,limit)));root.querySelector('[data-quantity-step="-1"]').disabled=limit<1||Number(input.value)<=1;root.querySelector('[data-quantity-step="1"]').disabled=limit<1||Number(input.value)>=limit;}
 for(const button of root.querySelectorAll('[data-quantity-step]'))button.addEventListener('click',()=>{input.value=String(Number(input.value)+Number(button.dataset.quantityStep));sync();onChange(Number(input.value));});
 input.addEventListener('change',()=>{sync();onChange(Number(input.value));});sync();return sync;
}
const colours={'black':'#202226','white':'#f5f5f0','pink':'#ed9ac2','teal':'#79b4af','ultramarine':'#737bd4','lavender':'#d1c4e3','mist blue':'#a8c5df','sage':'#adb999','burgundy':'#743d4b','glacier':'#c6d5df','silver':'#d7d9d8','soft pink':'#efd3d2','cloud white':'#f0f0e8','light gold':'#d9cba9','sky blue':'#adc9dc','space black':'#353737','night sky':'#283849','star white':'#eeede7','midnight':'#343d46','starlight':'#e2dccc','blue':'#8caab7','purple':'#c6b4d7'};
export function wireProductOptions(product,select,onChange){
 const box=document.querySelector('#product-options');
 const allowed=product.variants;
 const names=[...new Set(allowed.map(v=>v.color).filter(c=>c&&!/to confirm|pending|unknown/i.test(c)))];
 if(allowed.length&&!allowed.some(v=>v.id===select.value))select.value=allowed[0].id;
 function render(){
  const current=product.variants.find(v=>v.id===select.value)||product.variants[0];
  box.innerHTML=`${names.length?`<fieldset class="colour-choices"><legend>Colour <strong id="selected-colour">${e(current.color)}</strong></legend><div class="colour-swatches">${names.map(color=>{const swatch=colours[color.toLowerCase()];return `<button type="button" class="colour-swatch" data-colour="${e(color)}" aria-label="${e(color)}" aria-pressed="${current.color===color}"><span ${swatch?`data-tone="${color.toLowerCase()}"`:''}>${swatch?'':e(color.slice(0,2))}</span><span class="sr-only">${e(color)}</span></button>`;}).join('')}</div></fieldset>`:''}<label class="configuration-label" ${allowed.filter(v=>v.color===current.color).length===1&&(!current.configuration||current.configuration==='Standard configuration')?"hidden":""}>Configuration<select id="configuration-choice" ${allowed.length?'':'disabled'}>${(allowed.length?allowed.filter(v=>v.color===current.color):[current]).map(v=>`<option value="${e(v.id)}" ${v.id===current.id?'selected':''}>${e((v.configuration||'Standard configuration')+(v.stock===0?' · Out of Stock':''))}</option>`).join('')}</select></label>`;
  box.querySelectorAll('[data-colour]').forEach(button=>button.onclick=()=>{const matches=allowed.filter(v=>v.color===button.dataset.colour);const next=matches.find(v=>v.configuration===current.configuration&&purchaseLimit(product,v)>0)||matches.find(v=>purchaseLimit(product,v)>0)||matches.find(v=>v.configuration===current.configuration)||matches[0];select.value=next.id;render();onChange();[...box.querySelectorAll('[data-colour]')].find(b=>b.dataset.colour===next.color)?.focus({preventScroll:true});});
  box.querySelector('#configuration-choice').onchange=ev=>{select.value=ev.target.value;render();onChange();box.querySelector('#configuration-choice').focus({preventScroll:true});};
 }
 render();return render;
}
