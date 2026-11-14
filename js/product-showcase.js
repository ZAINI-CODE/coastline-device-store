import {displayVariant,productCard,icon} from './storefront-ui.js';
import {productImages} from './product-media.js';
export function showcaseMarkup(products){
 const items=products.filter(p=>p.variants?.length&&productImages(p,displayVariant(p)).length).slice(0,10);if(items.length<2)return '';
 return `<section class="wrap product-showcase" aria-label="Product showcase"><div class="section-head"><div><span class="eyebrow">IN THE SPOTLIGHT</span><h2>Meet your next favourite.</h2><p>Explore the collection at your own pace.</p></div><div class="showcase-controls"><button type="button" data-showcase-previous aria-label="Previous products">←</button><button type="button" data-showcase-pause aria-pressed="false" aria-label="Pause product motion">Pause</button><button type="button" data-showcase-next aria-label="Next products">${icon('arrow')}</button></div></div><div class="showcase-viewport" tabindex="0" aria-label="Swipe or use arrow keys to explore products"><div class="showcase-track"><div class="showcase-set">${items.map(productCard).join('')}</div></div></div></section>`;
}
export function wireShowcase(root){
 if(!root)return ()=>{};
 const viewport=root.querySelector('.showcase-viewport'),track=root.querySelector('.showcase-track'),set=track.firstElementChild,reduced=matchMedia('(prefers-reduced-motion: reduce)'),pause=root.querySelector('[data-showcase-pause]');
 const copy=set.cloneNode(true);copy.setAttribute('aria-hidden','true');copy.querySelectorAll('a').forEach(a=>a.tabIndex=-1);track.append(copy);
 let raf=0,last=0,position=viewport.scrollLeft,hover=false,focus=false,touch=false,userPaused=false,visible=false,resumeAt=0;
 const period=()=>set.getBoundingClientRect().width+18;
 function frame(now){raf=0;if(!root.isConnected)return;const dt=last?Math.min(40,now-last):0;last=now;const stop=reduced.matches||userPaused||hover||focus||touch||document.hidden||!visible||now<resumeAt;if(!stop){position=(position+dt*.025)%period();viewport.scrollLeft=position;}else position=viewport.scrollLeft;if(!reduced.matches&&!document.hidden&&visible)raf=requestAnimationFrame(frame);}
 function start(){if(!raf){last=0;position=viewport.scrollLeft;raf=requestAnimationFrame(frame);}}
 function interaction(){resumeAt=performance.now()+6000;start();}
 const handlers=[];function on(target,event,fn,options){target.addEventListener(event,fn,options);handlers.push(()=>target.removeEventListener(event,fn,options));}
 on(root,'mouseenter',()=>hover=true);on(root,'mouseleave',()=>{hover=false;start();});on(root,'focusin',()=>focus=true);on(root,'focusout',ev=>{focus=root.contains(ev.relatedTarget);start();});on(viewport,'pointerdown',()=>touch=true);on(window,'pointerup',()=>{if(touch){touch=false;interaction();}});on(window,'pointercancel',()=>{touch=false;interaction();});on(viewport,'wheel',interaction,{passive:true});on(viewport,'touchend',()=>{touch=false;interaction();},{passive:true});
 const move=direction=>{interaction();if(direction<0&&viewport.scrollLeft<10)viewport.scrollLeft=period();viewport.scrollBy({left:direction*Math.min(viewport.clientWidth*.8,600),behavior:reduced.matches?'instant':'smooth'});};
 on(root.querySelector('[data-showcase-previous]'),'click',()=>move(-1));on(root.querySelector('[data-showcase-next]'),'click',()=>move(1));on(pause,'click',()=>{userPaused=!userPaused;pause.textContent=userPaused?'Play':'Pause';pause.setAttribute('aria-pressed',String(userPaused));pause.setAttribute('aria-label',userPaused?'Resume product motion':'Pause product motion');start();});on(viewport,'keydown',ev=>{if(ev.target!==viewport)return;if(['ArrowLeft','ArrowRight'].includes(ev.key)){ev.preventDefault();move(ev.key==='ArrowLeft'?-1:1);}});
 const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)start();else{cancelAnimationFrame(raf);raf=0;}},{threshold:.01});observer.observe(root);on(document,'visibilitychange',()=>{if(!document.hidden)start();});on(reduced,'change',()=>{pause.disabled=reduced.matches;cancelAnimationFrame(raf);raf=0;if(!reduced.matches)start();});pause.disabled=reduced.matches;
 return ()=>{cancelAnimationFrame(raf);observer.disconnect();handlers.forEach(off=>off());};
}
