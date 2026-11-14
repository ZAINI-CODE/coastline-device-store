import {safeImage} from './core.js';
import {pricedCatalogueProduct} from './priced-catalogue.js';
const requested=['cyberpowerpc-et99707','ibuypower-ryzen-5-9500f','acer-nitro-85-n85-100-ur35','lenovo-legion-tower-5-gen-10-rtx-5070-ti','ps5-pro-2tb'];
export function ownerPreviewProducts(drafts,manifest){
 return drafts.flatMap(p=>{
  const assets=manifest.records.filter(r=>r.product_id===p.id&&r.review_status==='matched_for_local_review'&&safeImage(r.path));
  if(!assets.length&&!requested.includes(p.id)&&!p.catalogue_update)return [];
  const colours=[...new Set(assets.map(r=>r.color))].sort((a,b)=>Number(assets.some(r=>r.color===b&&r.angle==='main'))-Number(assets.some(r=>r.color===a&&r.angle==='main')));
  const variants=(colours.length?colours:['Colour to confirm']).map((color,i)=>{
   const images=assets.filter(r=>r.color===color).sort((a,b)=>Number(b.card_eligible)-Number(a.card_eligible)||Number(b.angle==='main')-Number(a.angle==='main'));
   const knownConfiguration=manifest.records.find(r=>r.product_id===p.id&&r.color===color&&r.configuration==='128GB')?.configuration;
   return {id:`owner-preview-${p.id}-${i}`,variant_key:`owner-${p.id}-${i}`,color,configuration:knownConfiguration||images[0]?.configuration||p.model_number||'Exact configuration pending',sku:p.model_number,stock:null,inventory:null,price_cents:null,active:false,image_path:images[0]?.path||null,images:images.map(r=>({path:r.path,hd_path:r.hd_path,product_id:p.id,color,label:r.angle==='detail'?'Camera / product detail':r.angle==='main'?'Product view':r.angle.replaceAll('-',' '),alt:`${p.name}, ${color}, ${r.angle}`,source_sha256:r.source_sha256,width:Math.min(960,r.normalized_width),height:Math.round(r.normalized_height*Math.min(1,960/r.normalized_width))}))};
  });
  // Keep existing approved exact-model photography when no owner gallery exists.
  if(!assets.length&&p.catalogue_update){const existing=(p.variants||[]).filter(v=>safeImage(v.image_path)&&v.image_permission==='approved');if(existing.length)variants.splice(0,variants.length,...existing.map(v=>({...v,images:[v.image_path,...(v.gallery_paths||[])].filter(safeImage).map(path=>({path,product_id:p.id,color:v.color}))})));}
  return [pricedCatalogueProduct({...p,review_only:true,owner_image_review:true,featured:requested.includes(p.id),model:p.model_number||'',variants,price:null,reference_price:p.supplied_price_reference?.price_cents??null,availability_reference:p.supplied_details?.raw?.Availability||'Availability Pending',review_count:0,rating:null,created_at:p.verified_on},variants)];
 });
}
