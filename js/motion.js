export function initializeMotion(){
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),running=new Set(),seen=new WeakSet();let observer,heroObserver,currentRoot;
 const badge=document.querySelector('#cart-count');
 if(badge)new MutationObserver(()=>{if(!reduced.matches)badge.animate?.([{transform:'scale(1)'},{transform:'scale(1.2)'},{transform:'scale(1)'}],{duration:220,easing:'ease-out'});}).observe(badge,{childList:true});
 function animate(element,delay=0){
  if(reduced.matches||!element.animate)return;
  const animation=element.animate([{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'translateY(0)'}],{duration:320,delay,easing:'cubic-bezier(.2,.7,.2,1)',fill:'backwards'});
  running.add(animation);animation.finished.catch(()=>{}).finally(()=>running.delete(animation));
 }
 function reveal(root){
  currentRoot=root;observer?.disconnect();heroObserver?.disconnect();for(const animation of running)animation.cancel();
  if(reduced.matches)return;
  if(!('IntersectionObserver' in window)){animate(root);return;}
  animate(root);
  observer=new IntersectionObserver(entries=>{let order=0;for(const entry of entries)if(entry.isIntersecting){observer.unobserve(entry.target);if(seen.has(entry.target))continue;seen.add(entry.target);if(entry.target.matches('.hero-copy'))[...entry.target.children].forEach((child,i)=>animate(child,i*55));else animate(entry.target,Math.min(order++*30,90));}},{threshold:.08,rootMargin:'0px 0px -12px 0px'});
  root.querySelectorAll('.hero-copy,.hero-device,.hero-product-caption,.category,.section-head,.product-card,.gaming,.split-section>a,.page>.panel,.account-grid>.panel,.directory-row,.editorial-tile,.collection-callout,.specification-group,.about-gallery figure,.about-page .policy-section,.iphone-deal,dialog').forEach(element=>observer.observe(element));
  const footer=document.querySelector('footer');if(footer&&!seen.has(footer))observer.observe(footer);
  heroObserver=new IntersectionObserver(entries=>{for(const entry of entries)entry.target.classList.toggle('is-inview',entry.isIntersecting);},{threshold:.01});
  root.querySelectorAll('.hero-showcase').forEach(element=>heroObserver.observe(element));
 }
 reduced.addEventListener('change',()=>{if(currentRoot)reveal(currentRoot);});
 document.addEventListener('visibilitychange',()=>document.documentElement.classList.toggle('motion-paused',document.hidden));
 return reveal;
}
