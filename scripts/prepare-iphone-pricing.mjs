import {readFile,writeFile} from 'node:fs/promises';
const root='https://www.apple.com/shop/buy-iphone/';
const groups=[
 ['iphone-16','Apple iPhone 16',[[null,829]]],
 ['iphone-17e','Apple iPhone 17e',[['256GB',699],['512GB',899]]],
 ['iphone-17','Apple iPhone 17',[['256GB',929],['512GB',1129]]],
 ['iphone-air','Apple iPhone Air',[['256GB',1099],['512GB',1299],['1TB',1699]]],
 ['iphone-18-pro','Apple iPhone 18 Pro',[['256GB',1199],['512GB',1399],['1TB',1799],['2TB',2399]]],
 ['iphone-18-pro-max','Apple iPhone 18 Pro Max',[['256GB',1299],['512GB',1499],['1TB',1899],['2TB',2499]]],
 ['iphone-duo','Apple iPhone Duo',[['256GB',1999],['512GB',2199],['1TB',2599],['2TB',3199]]]
];
const rows=groups.flatMap(([id,name,tiers])=>tiers.map(([storage,reference])=>({
 product_id:id,product_name:name,storage,reference_price_cents:reference*100,discount_cents:20000,proposed_price_cents:(reference-200)*100,discount_percent:200/reference*100,currency:'USD',
 source:root+(id==='iphone-18-pro-max'?'iphone-18-pro':id),checked_on:'2026-11-06',
 reference_type:'Apple US connect-to-carrier-later comparison, before tax',owner_rule:'USD 200 below supplied Apple reference',
 verification_status:id==='iphone-16'?'storage_confirmation_required':'selector_price_verified',
 note:id==='iphone-16'?'Apple selector: $829; lineup: from $799. Storage not exposed. Do not assign this quote to 128GB without confirmation.':id==='iphone-17'?'Unlocked selector starts at $929; lineup advertises from $899. Use the unlocked reference for this calculation.':'Storage/price pair checked against Apple US selector. Exact colour, condition, owned stock and image approval remain pending.',
 available:null,inventory:null,published:false
})));
const payload={as_of:'2026-11-06',currency:'USD',discount_per_phone_cents:20000,scope:'Proposed frontend pricing. Apple reference is not this store\'s former price. No tax, owned stock or live offer is implied.',rows};
await writeFile('data/iphone-pricing.json',JSON.stringify(payload,null,2)+'\n');
const products=JSON.parse(await readFile('data/products.json','utf8'));
for(const [id,name,tiers] of groups){
 let p=products.find(p=>p.id===id);
 if(!p){p={id,slug:id,name,brand:'Apple',category:'Apple iPhones',product_type:'Smartphone',model_number:null,officially_released:true,verified_on:'2026-11-06',source:root+id,verification_source:root+id,specifications:{'Verified storage options':tiers.map(t=>t[0]).join(', ')},description:'Apple smartphone currently listed in the US purchase catalogue. Exact retail configuration and owner availability are pending.',published:false,active:false,sale_price_cents:null,inventory:null,image_path:null,image_status:'pending_commercial_permission_and_exact_variant_photo',status:'pending_exact_photo_rights_and_owner_sale_details',variants:[]};products.push(p);}
 p.pricing_proposals=rows.filter(r=>r.product_id===id);
}
await writeFile('data/products.json',JSON.stringify(products,null,2)+'\n');
console.log(`${rows.length} storage-price proposals; ${products.length} total model records. No active price or stock changed.`);
