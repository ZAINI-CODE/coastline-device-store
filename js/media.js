import {escapeHTML as e} from './core.js';
import {productImages,mediaImage} from './product-media.js';
function selectedImage(products,id){const p=products.find(p=>p.id===id||p.keywords?.includes(id));const image=p?.variants.map(v=>productImages(p,v)[0]).find(Boolean);return image?{product:p,image}:null;}
export function heroMedia(products=[]){
 const chosen=selectedImage(products,'iphone-16');
 return chosen?`<div class="hero-art photo-art hero-showcase"><span class="hero-halo" aria-hidden="true"></span><span class="hero-orbit" aria-hidden="true"></span><a class="hero-device" href="#/product/${e(chosen.product.id)}" aria-label="Explore Apple iPhone 16"><span class="hero-device-surface">${mediaImage(chosen.image,{className:'hero-photo',lazy:false})}</span></a><span class="hero-product-caption"><span class="eyebrow">A CLOSER CONNECTION</span><span>iPhone 16</span><span class="hero-caption-line" aria-hidden="true"></span></span></div>`:'<div class="hero-art photo-art neutral-media" aria-hidden="true"></div>';
}
export function gamingMedia(products=[]){
 const chosen=['ibuypower-ryzen-5-9500f','lenovo-legion-tower-5-gen-10-rtx-5070-ti','ps5-original-disc'].map(id=>selectedImage(products,id)).find(Boolean);
 return `<div class="gaming-photo${chosen?'':' neutral-media'}">${chosen?mediaImage(chosen.image):''}</div>`;
}
export async function creditsPage(){
 const credits=await fetch('./data/photo-attributions.json').then(r=>r.json());
 return `<section class="wrap page prose"><h1>Photography acknowledgements</h1>${credits.map(r=>`<article class="panel"><h2>${e(r.product_name)}</h2><p>${e(r.author)} · <a href="${e(r.original_source)}">Original photograph</a> · <a href="${e(r.licence_url)}">${e(r.licence)}</a></p><p>${e(r.modifications)}</p></article>`).join('')}</section>`;
}
