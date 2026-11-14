import {safeImage} from './core.js';
// Read-only editorial review. Never invent prices, stock, database IDs or availability.
export function previewProducts(drafts,manifest){
 return drafts.flatMap(p=>{
  const variants=(p.variants||[]).filter(v=>safeImage(v.image_path)&&manifest.some(m=>m.product_id===p.id&&m.local_path===v.image_path&&m.permission_status==='approved'&&m.quality_status==='approved')).map((v,i)=>{
   const images=[v.image_path,...(v.gallery_paths||[])].flatMap(path=>{
    const m=manifest.find(m=>m.product_id===p.id&&m.local_path===path&&m.permission_status==='approved'&&m.quality_status==='approved');
    return m?[{path,product_id:p.id,color:v.color,configuration:v.configuration,label:m.angle||'Product view',alt:`${p.name}, ${v.color}`,source_sha256:m.source_sha256,width:m.source_width?Math.min(960,m.source_width):null,height:m.source_width?Math.round(m.source_height*Math.min(1,960/m.source_width)):null}]:[];
   });
   return {...v,images,id:'preview-'+p.id+'-'+i,stock:null,price_cents:null,sku:null,active:false};
  });
  return variants.length?[{...p,review_only:true,featured:true,model:p.model_number||'',variants,price:null,review_count:0,rating:null,created_at:p.verified_on}]:[];
 });
}
