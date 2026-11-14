import {escapeHTML as e,safeImage} from './core.js';
export function mediaShape(product){
 if(product.id==='iphone-duo'||product.keywords?.includes('iphone-duo'))return 'wide';
 const type=product.product_type||product.category||'';
 return /smartphone|iphone|console|desktop|gaming pc/i.test(type)?'portrait':/controller|headphone|airpod/i.test(type)?'wide':'balanced';
}
export function productImages(product,variant={}){
 const supplied=Array.isArray(variant.images)&&variant.images.length?variant.images:[{path:variant.image_path,label:'Product view'},...(Array.isArray(variant.gallery_paths)?variant.gallery_paths:[]).map((path,i)=>({path,label:`Additional view ${i+1}`}))];
 const seen=new Set();
 return supplied.flatMap((value,i)=>{
  const image=typeof value==='string'?{path:value}:value;
  if(!image||typeof image!=='object')return [];
  const path=safeImage(image.path);if(!path)return [];
  if(image.product_id&&image.product_id!==product.id)return [];
  if(image.variant_key&&image.variant_key!==variant.variant_key)return [];
  if(image.color&&image.color!==variant.color)return [];
  if(image.configuration&&image.configuration!==variant.configuration)return [];
  if(image.permission_status&&image.permission_status!=='approved'||image.quality_status&&image.quality_status!=='approved')return [];
  const key=image.source_sha256||path.replace(/-(480|960|1600)(?=\.webp$)/,'');
  if(seen.has(key))return [];seen.add(key);
  const label=image.label||image.angle||`View ${i+1}`;
  return [{...image,path,label,alt:image.alt||[product.name,variant.color,label].filter(Boolean).join(', '),width:Number(image.width)>0?Number(image.width):null,height:Number(image.height)>0?Number(image.height):null}];
 });
}
export function mediaImage(image,{className='',lazy=true,responsive=false}={}){
 const path=safeImage(image.path);if(!path)return '';
 const stem=path.replace(/-960\.webp$/,'');
 const srcset=responsive&&stem!==path?` srcset="./${e(stem)}-480.webp 480w, ./${e(stem)}-960.webp 960w" sizes="(max-width:600px) 44vw, (max-width:1000px) 45vw, 24vw"`:'';
 return `<img data-product-photo class="${e(className)}" src="./${e(path)}"${srcset} alt="${e(image.alt||'')}" ${lazy?'loading="lazy"':'fetchpriority="high"'} decoding="async"${image.width&&image.height?` width="${image.width}" height="${image.height}"`:''}>`;
}
