import {readFile,writeFile} from 'node:fs/promises';
const research=JSON.parse(await readFile('data/catalogue-expanded-research.json','utf8'));
const drafts=JSON.parse(await readFile('data/products.json','utf8'));
const manifest=JSON.parse(await readFile('data/image-manifest.json','utf8'));
const sourceProducts=[...research.products,...drafts.filter(d=>!research.products.some(p=>p.id===d.id)&&d.pricing_proposals?.length)];
const catalogue=sourceProducts.map(p=>{
 const existing=drafts.find(d=>d.id===p.id);
 const variants=(existing?.variants||[]).map(v=>({...v,price_cents:null,inventory:null,active:false}));
 const approved=manifest.find(m=>m.product_id===p.id&&m.local_path&&m.permission_status==='approved'&&m.quality_status==='approved');
 return {...p,...(existing?.pricing_proposals?{pricing_proposals:existing.pricing_proposals}:{}),variants,published:false,active:false,sale_price_cents:null,inventory:null,image_path:approved?.local_path||null,image_status:approved?'genuine_photo_approved_retail_revision_still_pending':'pending_commercial_permission_and_exact_variant_photo',status:approved?'pending_owner_sale_configuration_price_and_inventory':'pending_exact_photo_rights_and_owner_sale_details'};
});
await writeFile('data/products.json',JSON.stringify(catalogue,null,2)+'\n');
const gaps=catalogue.filter(p=>!p.image_path).map(p=>({product_id:p.id,name:p.name,category:p.category,manufacturer_source:p.verification_source,status:'unpublished',reason:'No exact-model, suitable-quality genuine photograph with confirmed commercial reuse rights has been approved. Manufacturer product-page presence is not a licence.'}));
await writeFile('docs/images/IMAGE-GAPS.json',JSON.stringify({checked_on:research.checked_on,research_count:catalogue.length,approved_photograph_count:catalogue.length-gaps.length,unpublished_count:catalogue.length,products:gaps,excluded:research.excluded},null,2)+'\n');
console.log(catalogue.length+' research drafts; '+(catalogue.length-gaps.length)+' with approved genuine photos; '+gaps.length+' image blockers. No sale offers published.');
