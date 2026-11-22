import {escapeHTML as e, money} from './core.js';
import {interfaceIcon as icon} from './interface-icons.js';
import {productImages, mediaImage} from './product-media.js';

const labels={payment_pending:'Payment pending',payment_verified:'Payment verified',placed:'Order placed',pending:'Pending',processing:'Processing',shipped:'Shipped',delivered:'Delivered',cancelled:'Cancelled',paid:'Paid',failed:'Failed',refunded:'Refunded',partially_refunded:'Partially refunded'};
export function orderStatus(value){
 const label=labels[value]||String(value||'Not available').replaceAll('_',' ');
 const tone=['paid','payment_verified','delivered'].includes(value)?'success':['failed','cancelled'].includes(value)?'danger':['pending','payment_pending'].includes(value)?'waiting':['placed','processing','shipped'].includes(value)?'progress':'neutral';
 return {label,tone};
}
function badge(value){const {label,tone}=orderStatus(value);return `<span class="order-badge order-badge--${tone}"><span aria-hidden="true"></span>${e(label)}</span>`;}
function dateMarkup(value){if(!value)return "Date unavailable";const date=new Date(value);return Number.isFinite(date.valueOf())?`<time datetime="${e(date.toISOString())}">${e(new Intl.DateTimeFormat('en-US',{dateStyle:'medium',timeStyle:'short'}).format(date))}</time>`:'Date unavailable';}

export function orderItemImage(item,catalogue){
 const product=catalogue.find(p=>p.id===item.product_id);
 const variant=product?.variants.find(v=>v.id===item.variant_id);
 if(!variant)return null;
 // A historical order keeps its recorded configuration, even if the catalogue changes later.
 const description=[variant.color,variant.configuration].filter(Boolean).join(' / ');
 if(String(item.variant||'').trim().toLowerCase()!==description.trim().toLowerCase())return null;
 return productImages(product,variant)[0]||null;
}
function itemMarkup(item,catalogue){
 const image=orderItemImage(item,catalogue);
 return `<li class="order-product"><div class="order-product-photo">${image?mediaImage({...image,alt:item.product_name},{className:'order-product-image'}):`<span class="order-product-symbol" aria-hidden="true">${icon('package')}</span>`}</div><div class="order-product-copy"><h4>${e(item.product_name)}</h4><p>${e(item.variant)}</p><span class="order-item-quantity">Quantity: <strong>${e(item.quantity)}</strong></span></div><div class="order-unit-price"><strong>${money(item.unit_price_cents)}</strong><span>each</span></div></li>`;
}
export function orderCard(order,catalogue=[]){
 const items=order.order_items||[],address=order.shipping_address||{};
 const history=[...(order.order_status_history||[])].sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
 const destination=[[address.line1,address.line2].filter(Boolean).join(', '),[address.city,address.state,address.postal_code].filter(Boolean).join(', '),address.country].filter(Boolean);
 return `<article class="order-card" aria-label="Order ${e(order.id)}">
  <header class="order-card-header"><div class="order-id-group"><span class="order-label">ORDER ID</span><div class="order-id-row"><h3>${e(order.id)}</h3><button type="button" class="order-copy" data-order-copy="${e(order.id)}" aria-label="Copy order ID ${e(order.id)}">${icon('copy')}</button></div></div><div class="order-date">${icon('calendar')}<span><span class="order-label">Order placed</span>${dateMarkup(order.created_at)}</span></div></header>
  <div class="order-status-row"><div><span class="order-label">Order status</span>${badge(order.status)}</div><div><span class="order-label">Payment status</span>${badge(order.payment_status)}</div><div class="order-total">${icon('layers')}<span><span class="order-label">Order total</span><strong>${money(order.total_cents)}</strong></span></div></div>
  <div class="order-card-body"><section class="order-items"><h4 class="order-section-heading">${icon('bag')}Order items <span class="order-item-count">${items.length}</span></h4><ul class="order-product-list">${items.map(item=>itemMarkup(item,catalogue)).join('')}</ul></section><aside class="order-delivery"><section><h4 class="order-section-heading">${icon('pin')}Delivery address</h4><div class="order-address"><strong>${e(address.full_name||'Recipient not recorded')}</strong><address>${destination.map(line=>e(line)).join('<br>')||'Address not recorded'}</address></div></section><section class="order-tracking"><h4 class="order-section-heading">${icon('truck')}Tracking information</h4>${order.tracking_number?`<div class="order-tracking-details"><span class="order-label">${e(order.carrier||'Carrier not recorded')}</span><strong>${e(order.tracking_number)}</strong></div>`:`<p class="order-tracking-empty">${icon('info')}<span>Tracking has not been added yet.</span></p>`}</section></aside></div>
  <div class="order-card-footer">${['pending','processing'].includes(order.payment_status)&&!order.stock_released?`<a class="button order-payment-link" href="#/checkout?order=${encodeURIComponent(order.id)}">Review order & payment ${icon('arrow')}</a>`:''}<span class="order-payment-method">${icon('card')} ${e(order.method==='zelle'?'Zelle':order.method==='paypal'?'PayPal':order.method||'Payment method not recorded')}</span><span class="order-copy-status" role="status" aria-live="polite"></span></div>
  <details class="order-timeline"><summary>${icon('history')}Status history</summary>${history.length?`<ol>${history.map(entry=>`<li><span class="order-timeline-dot" aria-hidden="true"></span><div>${dateMarkup(entry.created_at)}<p>${e(orderStatus(entry.status).label)} <span>· Payment: ${e(orderStatus(entry.payment_status).label)}</span></p></div></li>`).join('')}</ol>`:'<p>No status updates recorded yet.</p>'}</details>
 </article>`;
}
export function orderHistoryMarkup(orders,catalogue=[]){
 return `<section class="order-history-section" aria-labelledby="order-history"><div class="order-history-heading"><span class="order-title-icon">${icon('bag')}</span><div><h2 id="order-history">Order history & tracking</h2><p>View your past orders, check their status and follow deliveries.</p></div></div>${orders.length?`<div class="order-history-list">${orders.map(order=>orderCard(order,catalogue)).join('')}</div>`:`<div class="empty order-history-empty"><span class="state-icon">${icon('bag')}</span><h3>Your first order starts here.</h3><p>Your order details and delivery updates will appear here after checkout.</p><a class="button" href="#/shop">Explore the collection ${icon('arrow')}</a></div>`}</section>`;
}
export function wireOrderHistory(root=document){
 root.querySelectorAll('[data-order-copy]').forEach(button=>button.addEventListener('click',async()=>{
  const status=button.closest('.order-card').querySelector('.order-copy-status');
  try{await navigator.clipboard.writeText(button.dataset.orderCopy);status.textContent='Order ID copied.';}catch{status.textContent='Copy unavailable. Select the order ID above to copy it.';}
 }));
}
