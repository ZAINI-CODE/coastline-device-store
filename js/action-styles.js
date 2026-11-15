export function orderActionIntent(action){return ['cancel','cancel_zelle','refund'].includes(action)?'destructive':['processing','shipped','delivered','verify_zelle'].includes(action)?'positive':'general';}
export function styleActions(root=document){
 const mark=(selector,intent)=>root.querySelectorAll(selector).forEach(el=>el.dataset.intent=intent);
 mark('#add,#buy-now,#checkout button[type=submit],.zelle-submission button,.bundle-form button[type=submit],#profile button[type=submit],#address button[type=submit],[data-approved="true"],#mfa button','positive');
 mark('.remove,[data-delete-address],[data-approved="false"],#remove-avatar,#delete-record,[data-delete]','destructive');
 root.querySelectorAll('.admin-order').forEach(form=>{const select=form.elements.action,button=form.querySelector('button');const update=()=>button.dataset.intent=orderActionIntent(select.value);select.addEventListener('change',update);update();});
}
