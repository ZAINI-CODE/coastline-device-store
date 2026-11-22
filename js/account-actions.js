import {escapeHTML as e} from './core.js';
import {interfaceIcon as icon} from './interface-icons.js';

export function accountActionsMarkup(catalogue=[],reviews=[],showReviewAction=true){
 const reviewed=new Set(reviews.map(review=>review.product_id));
 const available=catalogue.some(product=>!reviewed.has(product.id));
 return `<div class="account-review-action" ${showReviewAction?'':'hidden'}><button type="button" class="button" id="account-add-review" aria-haspopup="dialog" aria-controls="account-review-dialog">Add a Review ${icon('arrow')}</button></div>
 <dialog id="account-review-dialog" class="store-dialog account-dialog" aria-labelledby="account-review-title"><div class="dialog-top"><h2 id="account-review-title">Add a review</h2><button type="button" class="dialog-close" data-close-account-dialog aria-label="Close product selection">×</button></div><p>Choose the product you would like to review.</p>${available?`<form id="account-review-product"><label>Product<select name="product" required autofocus><option value="">Choose a product</option>${catalogue.map(product=>`<option value="${e(product.id)}" ${reviewed.has(product.id)?'disabled':''}>${e(product.name)}${reviewed.has(product.id)?' · Review already submitted':''}</option>`).join('')}</select></label><button type="submit" class="button">Continue to review ${icon('arrow')}</button></form>`:`<p class="field-help">${catalogue.length?'You have already submitted reviews for all currently listed products.':'The product list is temporarily unavailable. Please try again later.'}</p>`}</dialog>
 <dialog id="signout-dialog" class="store-dialog account-dialog signout-dialog" aria-labelledby="signout-title" aria-describedby="signout-description"><div class="dialog-top"><h2 id="signout-title">Sign out?</h2><button type="button" class="dialog-close" data-close-account-dialog aria-label="Close sign-out confirmation">×</button></div><p id="signout-description">Are you sure you want to sign out of your account?</p><div class="account-dialog-actions"><button type="button" data-close-account-dialog autofocus>Stay signed in</button><button type="button" id="confirm-signout" class="button action-destructive">Sign out</button></div><p id="signout-result" role="status" aria-live="polite"></p></dialog>`;
}

export function reviewProductRoute(id){return typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)?'/product/'+id+'?review=1':null;}

export function wireAccountActions(onSignOut,root=document){
 const logout=root.querySelector('#logout'),signout=root.querySelector('#signout-dialog');
 const picker=root.querySelector('#account-review-dialog'),review=root.querySelector('#account-add-review');
 let busy=false;
 root.querySelectorAll('.account-dialog [data-close-account-dialog]').forEach(button=>button.addEventListener('click',()=>{if(!busy)button.closest('dialog').close();}));
 if(logout&&signout){
  logout.setAttribute('aria-haspopup','dialog');logout.setAttribute('aria-controls','signout-dialog');
  logout.addEventListener('click',()=>{signout.querySelector('#signout-result').textContent='';signout.showModal();});
  signout.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  signout.querySelector('#confirm-signout').addEventListener('click',async()=>{
   if(busy)return;busy=true;const buttons=[...signout.querySelectorAll('button')];buttons.forEach(button=>button.disabled=true);
   try{await onSignOut();if(signout.open)signout.close();}
   catch{signout.querySelector('#signout-result').textContent='We could not sign you out. Please try again.';}
   finally{busy=false;buttons.forEach(button=>button.disabled=false);}
  });
 }
 review?.addEventListener('click',()=>picker.showModal());
 root.querySelector('#account-review-product')?.addEventListener('submit',event=>{
  event.preventDefault();const select=event.currentTarget.elements.product;
  const route=reviewProductRoute(select.value);if(!route||!select.value||select.selectedOptions[0]?.disabled)return;
  picker.close();location.hash=route;
 });
}
