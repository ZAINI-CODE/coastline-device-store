import {interfaceIcon} from './interface-icons.js';
import {escapeHTML as e} from './core.js';
import {productImages,mediaImage,mediaShape} from './product-media.js';
import {heroMedia,gamingMedia} from './media.js';
import {purchaseLimit} from './product-options.js';
import {productOffer,productPriceMarkup} from './product-promotions.js';

const paths={phone:'M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2ZM10 18h4',audio:'M4 14v-3a8 8 0 0 1 16 0v3M4 12H3v7h4v-7H4Zm16 0h1v7h-4v-7h3Z',console:'M8 3h8l3 18H5L8 3Zm2 5h4m-4 4h4',controller:'M7 7h10c3 0 5 10 3 11-2 1-4-3-5-3H9c-1 0-3 4-5 3C2 17 4 7 7 7Zm0 3v4m-2-2h4m7-1h.01M18 13h.01',cpu:'M6 6h12v12H6V6Zm4 4h4v4h-4v-4ZM9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4',pc:'M6 2h12v20H6V2Zm3 4h6M9 10h6m-3 7h.01',arrow:'M5 12h14m-6-6 6 6-6 6',check:'m5 12 4 4L19 6',shield:'M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6l-9-4Zm-4 10 3 3 5-6',grid:'M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7'};
export function icon(name){if(interfaceIcon(name))return interfaceIcon(name);return `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.arrow}"/></svg>`;}
export function displayVariant(p){
 const available=p.variants.filter(v=>purchaseLimit(p,v)>0);
 const choices=available.length?available:p.variants;
 return choices.find(v=>productImages(p,v).length)||choices[0];
}
export function availability(variant){
 if(!Number.isInteger(variant.stock))return 'Stock not confirmed';
 return variant.stock>0?'In Stock':'Out of Stock';
}
export function productCard(p){
 const v=displayVariant(p);if(!v)return '';const image=productImages(p,v)[0];
 const route=`#/product/${e(p.id)}?variant=${encodeURIComponent(v.id)}`;
 const url=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(p.id)?`./pages/products/${e(p.id)}.html${route}`:route;
 const price=productPriceMarkup(p,v);
 return `<article class="product-card"><a href="${url}"><div class="product-image media-${mediaShape(p)}${image?'':' neutral-media'}" ${image?'':'aria-hidden="true"'}>${image?mediaImage(image,{responsive:true}):''}</div><div class="card-copy"><small>${e(p.brand)}</small><h3>${e(p.name)}</h3><p class="card-description">${e(p.description)}</p>${price}${p.review_count?`<span class="stock">${Number(p.rating).toFixed(1)} / 5 · ${p.review_count} reviews</span>`:''}<span class="stock">${availability(v)}</span><span class="card-action">${p.variants.length>1?'Choose Options':'View Details'} ${icon('arrow')}</span></div></a></article>`;
}
function collection(title,description,items,link){return `<section class="wrap section"><div class="section-head"><div><span class="eyebrow">THE TECHNOLOGY EDIT</span><h2>${title}</h2><p>${description}</p></div><a class="text-link" href="${link}">View collection ${icon('arrow')}</a></div><div class="product-grid">${items.map(productCard).join('')}</div></section>`;}
function feature(products,keyword,title,copy,link,tone){const p=products.find(x=>x.id===keyword||x.keywords?.includes(keyword)),image=p?.variants[0]&&productImages(p,p.variants[0])[0];return `<a class="editorial-tile ${tone}" href="${link}"><div><span class="eyebrow">${tone==='audio-edit'?'THE AUDIO EDIT':'EVERYDAY, ELEVATED'}</span><h2>${title}</h2><p>${copy}</p><span class="text-link">Explore collection ${icon('arrow')}</span></div>${image?mediaImage(image,{responsive:true}):'<span class="editorial-symbol">'+icon(tone==='audio-edit'?'audio':'phone')+'</span>'}</a>`;}
export function iphoneDeal(products,now=Date.now()){
 const eligible=products.filter(p=>p.category==='Apple iPhones').map(p=>({p,v:displayVariant(p)})).filter(({p,v})=>v&&productOffer(p,v,now)?.basisPoints===1500&&productImages(p,v).length);
 const choice=eligible.find(({p})=>/^(Apple )?iPhone 16$/i.test(p.name))||eligible[0];
 if(!choice)return '';
 const {p,v}=choice,image=productImages(p,v)[0],route=`#/product/${encodeURIComponent(p.id)}?variant=${encodeURIComponent(v.id)}`;
 return `<section class="wrap iphone-deal"><div><span class="eyebrow">THE IPHONE DEAL</span><h2>Your next iPhone.<br>A little more within reach.</h2><p>${e(p.name)} · ${e([v.color,v.configuration].filter(Boolean).join(' / '))}</p>${productPriceMarkup(p,v,{now})}<a class="button" href="${route}">Explore this iPhone ${icon('arrow')}</a><p class="deal-note">15% off during the active campaign. No stacked discounts. Choose an available variant to see its price.</p></div><a class="iphone-deal-image" href="${route}" aria-label="View ${e(p.name)}">${mediaImage(image,{responsive:true})}</a></section>`;
}
export function storefrontHome(products,store){
 const phones=products.filter(p=>p.category==='Apple iPhones').sort((a,b)=>Number(Boolean(productImages(b,displayVariant(b)).length))-Number(Boolean(productImages(a,displayVariant(a)).length))).slice(0,4);
 const audio=products.filter(p=>p.category==='Apple Products and Headphones'&&p.variants.some(v=>productImages(p,v).length));
 return `<section class="hero wrap"><div class="hero-copy"><div class="pill"><span></span> THE NEXT CONNECTION</div><h1>Better tech.<br><em>More possibility.</em></h1><p>For the moments you connect, the music you feel, and the games you get lost in. Find your next favourite.</p><div class="hero-actions"><a class="button" href="#/shop">Explore Products ${icon('arrow')}</a><a class="text-link" href="#/shop">Shop Now ${icon('arrow')}</a></div><div class="hero-foot"><span class="line"></span><span>PHONES. AUDIO. PLAY. PERFORMANCE.</span></div></div>${heroMedia(products)}</section>
 <section class="category-section wrap"><div class="section-head"><div><span class="eyebrow">FIND YOUR FOCUS</span><h2>A world of possibilities.</h2></div><a class="text-link" href="#/shop">All products ${icon('arrow')}</a></div><div class="category-grid">${store.categories.map((c,i)=>`<a class="category" href="#/shop?category=${encodeURIComponent(c)}"><span class="category-number">0${i+1}${icon('arrow')}</span><span class="category-icon">${icon(({'Apple iPhones':'phone','Apple Products and Headphones':'audio','Gaming Consoles':'console','Gaming PCs':'pc'})[c])}</span><h3>${e(c)}</h3><span>Explore collection</span></a>`).join('')}</div></section>
 ${collection('Made for your everyday.','Explore the iPhone collection. Choose your model, finish and configuration.',phones,'#/shop?category=Apple%20iPhones')}
 ${iphoneDeal(products)}
 <section class="wrap editorial-grid">${feature(products,'iphone-air','Light in your hand.<br>Big on possibility.','Discover the iPhone Air collection.','#/shop?category=Apple%20iPhones','apple-edit')}${feature(products,'airpods-pro-3','Your world.<br>A different sound.','Find your fit in our Apple audio collection.','#/shop?category=Apple%20Products%20and%20Headphones','audio-edit')}</section>
 <section class="gaming wrap"><div><span class="eyebrow">THE GAMING EDIT / 01</span><h2>Make room for<br>your next level.</h2><p>Explore gaming desktops, PlayStation consoles. Every setup starts with the right details.</p><div class="hero-actions"><a href="#/shop?category=Gaming%20PCs" class="button light">Explore gaming PCs ${icon('arrow')}</a><a class="text-link" href="#/shop?category=Gaming%20Consoles">PlayStation ${icon('arrow')}</a></div></div>${gamingMedia(products)}<span class="gaming-caption">PLAY / WITHOUT LIMITS</span></section>
 ${audio.length?collection('Sound worth exploring.','A closer look at the Apple audio selection.',audio.slice(0,4),'#/shop?category=Apple%20Products%20and%20Headphones'):''}
 <section class="wrap collection-callout"><div><span class="eyebrow">THE FULL PICTURE</span><h2>Find what moves you.</h2><p>Compare the details. Explore the finishes. Build your selection.</p></div><a class="button" href="#/shop">Explore all products ${icon('arrow')}</a></section>
 <section class="service-strip wrap"><div>${icon('grid')}<span><strong>The details matter</strong><small>Explore specifications and configurations</small></span></div><div>${icon('shield')}<span><strong>Your own space</strong><small>Account and order information</small></span></div><div>${icon('check')}<span><strong>Know before you choose</strong><small>Shipping, returns and store information</small></span></div></section>`;
}
