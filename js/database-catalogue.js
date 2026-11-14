import {safeImage} from './core.js';
export function databaseCatalogue(rows){
 return rows.map(p=>{
  const variants=p.variants.map(v=>{
   const image_path=safeImage(v.image_path), gallery_paths=v.gallery_paths.filter(safeImage);
   const images=[image_path,...gallery_paths].filter(Boolean).map((path,index)=>({
    path,hd_path:/^images\/products\/owner-[\w.-]+-960\.webp$/.test(path)?path.replace(/-960\.webp$/,'-1600.webp'):path,
    label:index===0?'Product view':`Additional view ${index}`
   }));
   return {...v,color:/to confirm|pending|unknown/i.test(v.color)?null:v.color,image_path,gallery_paths,images};
  });
  const prices=variants.map(v=>v.price_cents).filter(Number.isInteger);
  return {...p,model_number:p.model===p.name?null:p.model,variants,price:prices.length?Math.min(...prices):null};
 });
}
