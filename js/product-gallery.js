import {escapeHTML as e} from './core.js';
import {productImages,mediaShape,mediaImage} from './product-media.js';
export function mountGallery(container,product,variant){
 container.onkeydown=null;
 const images=productImages(product,variant);let selected=0,selectionVersion=0;
 if(!images.length){container.innerHTML=`<div class="product-gallery media-${mediaShape(product)}" aria-hidden="true"><div class="gallery-stage neutral-media"></div></div>`;return;}
 container.innerHTML=`<section class="product-gallery media-${mediaShape(product)}" aria-label="Product images"><div class="gallery-stage" aria-busy="false">${mediaImage({...images[0],path:images[0].hd_path||images[0].path},{className:'gallery-main',lazy:false})}</div>${images.length>1?`<div class="gallery-toolbar"><button type="button" data-gallery-step="-1" aria-label="Previous image">←</button><p class="gallery-caption" aria-live="polite">${e(images[0].label)} · 1 of ${images.length}</p><button type="button" data-gallery-step="1" aria-label="Next image">→</button></div><div class="gallery-thumbs" role="group" aria-label="Choose a product image">${images.map((image,i)=>`<button type="button" data-gallery-index="${i}" aria-label="Show ${e(image.label)}" aria-pressed="${i===0}">${mediaImage({...image,path:image.path.replace(/-960\.webp$/,'-480.webp'),alt:''})}</button>`).join('')}</div>`:''}</section>`;
 const main=container.querySelector('.gallery-main'),stage=container.querySelector('.gallery-stage'),caption=container.querySelector('.gallery-caption');
 const show=async index=>{
  selected=(index+images.length)%images.length;const current=selected,image=images[current],version=++selectionVersion;
  container.querySelectorAll('[data-gallery-index]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.galleryIndex)===current)));
  stage.setAttribute('aria-busy','true');caption.textContent=`${image.label} · ${current+1} of ${images.length}`;
  const preload=new Image();preload.src='./'+(image.hd_path||image.path);
  try{await preload.decode();if(version!==selectionVersion)return;
   main.src=preload.src;main.alt=image.alt;main.hidden=false;
   stage.classList.remove('neutral-media');
   if(!matchMedia('(prefers-reduced-motion: reduce)').matches)main.animate?.([{opacity:.3},{opacity:1}],{duration:220,easing:'ease-out'});
  }catch{if(version!==selectionVersion)return;main.hidden=true;stage.classList.add('neutral-media');}
  finally{if(version===selectionVersion)stage.setAttribute('aria-busy','false');}
 };
 container.querySelectorAll('[data-gallery-index]').forEach(button=>button.addEventListener('click',()=>show(Number(button.dataset.galleryIndex))));
 container.querySelectorAll('[data-gallery-step]').forEach(button=>button.addEventListener('click',()=>show(selected+Number(button.dataset.galleryStep))));
 container.onkeydown=event=>{if(images.length>1&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)&&event.target.closest('.gallery-thumbs')){event.preventDefault();const index=event.key==='Home'?0:event.key==='End'?images.length-1:selected+(event.key==='ArrowRight'?1:-1);show(index);container.querySelector(`[data-gallery-index="${selected}"]`).focus();}};
}
