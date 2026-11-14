import {escapeHTML as e,money} from './core.js';
export function suppliedProductDetails(product){
 const d=product.supplied_details;if(!d)return '';
 const r=d.raw||{},price=product.supplied_price_reference;
 return `<details class="supplied-product-details"><summary>Supplied reference details and pending checks</summary><p>Imported from ${e(d.source_file)}. Supplier prices, availability and terms require confirmation for this store.</p>${price?.price_cents!=null?`<p>Supplied price reference: ${money(price.price_cents)}. This is not an active store offer.</p>`:''}<dl>${['Availability','Warranty / Service','Shipping / Rush','Discount / Offer','Other Details'].filter(k=>r[k]).map(k=>`<dt>${e(k)} (as supplied)</dt><dd>${e(r[k])}</dd>`).join('')}</dl><ul>${d.notes.map(n=>`<li>${e(n)}</li>`).join('')}</ul></details>`;
}
