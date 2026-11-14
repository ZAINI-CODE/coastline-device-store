import {readFile,writeFile,mkdir,access,readdir,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {escapeHTML as e,safeImage} from '../js/core.js';
import {informationPage} from '../js/content.js';
import {databaseCatalogue} from '../js/database-catalogue.js';
import {storefrontHome,productCard} from '../js/storefront-ui.js';
import {productOffer} from '../js/product-promotions.js';
import {purchaseLimit} from '../js/product-options.js';
import {specificationsMarkup} from '../js/product-specifications.js';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export const jsonLD=value=>JSON.stringify(value).replaceAll('<','\\u003c');
export function seoSettings(store,env=process.env){
 const raw=env.PUBLIC_SITE_URL||env.DEPLOY_PRIME_URL||(env.VERCEL_URL?'https://'+env.VERCEL_URL:'')||env.URL||store.domain;
 const base=raw?new URL(raw):null;
 if(base&&(base.protocol!=='https:'||base.username||base.password||base.search||base.hash))throw new Error('SEO base URL must be an HTTPS URL without credentials, query or fragment.');
 if(env.PUBLIC_INDEXING_ENABLED&&!['true','false'].includes(env.PUBLIC_INDEXING_ENABLED))throw new Error('PUBLIC_INDEXING_ENABLED must be true or false');
 const indexable=env.PUBLIC_INDEXING_ENABLED==='true';
 if(indexable&&!base)throw new Error('An indexing-enabled build requires its deployment base URL');
 return {home:base?base.href.replace(/\/?$/,'/'):null,indexable};
}
const productPath=id=>`pages/products/${id}.html`;
function htmlPage(template,{title,description,base,route,canonical,body,schema,image,indexable}){
 let html=template.replace(/<title>[\s\S]*?<\/title>/,`<title>${e(title)}</title>`)
 .replace(/<meta name="description" content="[^"]*">/,`<meta name="description" content="${e(description)}">`)
 .replace(/<meta name="robots" content="[^"]*">/,`<meta name="robots" content="${indexable?'index,follow':'noindex,nofollow'}">`)
 .replace('<head>',`<head><base href="${base}">`).replace('<body>',`<body data-route="${e(route)}">`)
 .replace(/(<main id="main" tabindex="-1">)[\s\S]*?<\/main>/,(_,open)=>open+body+'</main>');
 const tags=`${canonical?`<link rel="canonical" href="${e(canonical)}"><meta property="og:url" content="${e(canonical)}">`:''}<meta property="og:title" content="${e(title)}"><meta property="og:description" content="${e(description)}"><meta property="og:type" content="${schema?'product':'website'}">${image?`<meta property="og:image" content="${e(image)}">`:''}${schema?`<script type="application/ld+json">${jsonLD(schema)}</script>`:''}`;
 html=html.replace('</head>',tags+'</head>');
 // Crawlable links use the same existing product route when JavaScript loads.
 return html.replace(/href="#\/product\/([a-f0-9-]{36})([^"\s]*)"/gi,(_,id,query)=>`href="./${productPath(id)}#/product/${id}${query}"`)
 .replace(/href="#\/shop\?category=([^"\s]+)"/g,(_,category)=>`href="./categories/${decodeURIComponent(category).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}/"`)
 .replaceAll('href="#/shop"','href="./shop/"');
}
function normalize(rows,promotions){
 return rows.filter(p=>p.published!==false).map(p=>{
  if(p.database_id)return {...p,id:p.database_id,variants:p.variants.map(v=>({...v,stock:v.inventory,images:[{path:v.image_path}],gallery_paths:[]}))};
  return databaseCatalogue([p])[0];
 }).filter(p=>uuid.test(p.id)).map(p=>({...p,promotions:promotions.filter(x=>x.promotion_products?.some(r=>r.product_id===p.id))}));
}
export async function buildSEO(store,options={}){
 const {home,indexable}=seoSettings(store,options.env||process.env);
 const rows=options.products||[]; // Never fall back to the legacy draft catalogue.
 const products=normalize(rows,options.promotions||[]);
 const content=options.content||JSON.parse(await readFile('config/content.json','utf8'));
 const template=options.template||await readFile('index.html','utf8');
 const output=options.outputDirectory||'dist',now=options.now??Date.now();
 await mkdir(join(output,'pages/products'),{recursive:true});
 for(const f of await readdir(join(output,'pages/products')))if(uuid.test(f.replace(/\.html$/,''))&&f.endsWith('.html'))await unlink(join(output,'pages/products',f));
 const urls=home?[home]:[];
 const write=async(path,args)=>{await mkdir(join(output,path.substring(0,path.lastIndexOf('/'))||'.'),{recursive:true});await writeFile(join(output,path),htmlPage(template,{...args,indexable}));};
 for(const [key,page] of Object.entries(content)){
  if(!/^[a-z-]+$/.test(key))continue;
  const canonical=home?new URL(key+'/',home).href:null;
  const args={title:page.title+' · '+store.name,description:page.paragraphs.join(' '),base:'../',route:'/'+key,canonical,body:informationPage(key,content,store)};
  await write(`pages/${key}.html`,args);await write(`${key}/index.html`,args);if(canonical)urls.push(canonical);
 }
 for(const p of products){
  const variants=p.variants.filter(v=>safeImage(v.image_path));
  for(const v of variants)await access(v.image_path);
  const canonical=home?new URL(productPath(p.id),home).href:null;
  const image=variants[0]?.image_path;
  const schema={'@context':'https://schema.org','@graph':[{'@type':'Product',name:p.name,description:p.description,brand:{'@type':'Brand',name:p.brand},model:p.model_number||undefined,image:home?variants.map(v=>new URL(v.image_path,home).href):undefined,
   offers:p.variants.filter(v=>purchaseLimit(p,v)>0&&v.sku).map(v=>{
    const offer=productOffer(p,v,now);
    return {'@type':'Offer',sku:v.sku,price:((offer?.price??v.price_cents)/100).toFixed(2),priceCurrency:'USD',availability:'https://schema.org/InStock',url:canonical,...(offer?{priceValidUntil:new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(offer.ends-1))}:{} )};
   })},...canonical?[{'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Home',item:home},{'@type':'ListItem',position:2,name:p.name,item:canonical}]}]:[]]};
  // No fabricated rating/reviews. No Offer when purchase data is incomplete.
  if(!schema['@graph'][0].offers.length)delete schema['@graph'][0].offers;
  const body=`<section class="wrap page"><a href="./shop/">Explore the collection</a><div class="detail-grid"><div>${image?`<img class="credit-image" src="./${e(image)}" alt="${e(p.name+' '+(variants[0].color||''))}">`:''}</div><article><span class="eyebrow">${e(p.brand)}</span><h1>${e(p.name)}</h1><p>${e(p.description)}</p>${specificationsMarkup(p,p.variants[0])}<a class="button" href="#/product/${e(p.id)}">View current options and availability</a></article></div></section>`;
  await write(productPath(p.id),{title:p.name+' · '+store.name,description:p.description,base:'../../',route:'/product/'+p.id,canonical,body,schema,image:home&&image?new URL(image,home).href:null});if(canonical)urls.push(canonical);
 }
 const categories=[...new Set(products.map(p=>p.category).filter(Boolean))];
 const slug=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
 for(const category of categories){
  const path=`categories/${slug(category)}/`,canonical=home?new URL(path,home).href:null;
  await write(path+'index.html',{title:category+' · '+store.name,description:'Explore '+category+' at '+store.name+'.',base:'../../',route:'/shop?category='+encodeURIComponent(category),canonical,body:`<section class="wrap page"><h1>${e(category)}</h1><div class="product-grid">${products.filter(p=>p.category===category).map(productCard).join('')}</div></section>`});if(canonical)urls.push(canonical);
 }
 const categoryLinks=categories.map(c=>`<a href="./categories/${slug(c)}/">${e(c)}</a>`).join(' · ');
 const shopCanonical=home?new URL('shop/',home).href:null;
 await write('shop/index.html',{title:'Shop electronics · '+store.name,description:'Browse the Coastline Device product collection.',base:'../',route:'/shop',canonical:shopCanonical,body:`<section class="wrap page"><h1>Shop electronics</h1><nav aria-label="Product categories">${categoryLinks}</nav><div class="product-grid">${products.map(productCard).join('')}</div></section>`});if(shopCanonical)urls.push(shopCanonical);
 await write('index.html',{title:store.name+' · Modern technology. Reliable shopping.',description:'Explore phones, Apple audio and gaming products at Coastline Device.',base:'./',route:'/',canonical:home,body:storefrontHome(products,{...store,categories})});
 await writeFile(join(output,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[...new Set(urls)].map(url=>`<url><loc>${e(url)}</loc></url>`).join('')}</urlset>`);
 await writeFile(join(output,'robots.txt'),`User-agent: *\n${indexable?'Allow: /':'Disallow: /'}\n${home?'Sitemap: '+new URL('sitemap.xml',home).href+'\n':''}`);
 return urls;
}
