import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {catalogueID} from './catalogue-import-plan.mjs';
import {ownerPreviewProducts} from '../js/owner-catalogue-preview.js';
export function persistentCatalogue(products,media){
 const preview=ownerPreviewProducts(products,media);
 return {version:1,allocation:'PROVISIONAL DEMO — not verified physical inventory',products:preview.filter(p=>p.catalogue_update).map(p=>{
  const variants=p.variants.map(v=>({v,key:`${p.id}/${v.color}/${v.configuration}`})).sort((a,b)=>a.key.localeCompare(b.key));
  const base=Math.floor(15/variants.length),remainder=15%variants.length;
  return {id:catalogueID('product',p.id),catalogue_key:p.id,name:p.name,brand:p.brand,model:p.model_number||p.name,category:p.category,description:p.description,
   specifications:{...p.specifications,...Object.fromEntries(Object.entries(p.supplied_details?.raw||{}).filter(([k])=>!['Price (as provided)','Original Price','Sale Price','Availability','Discount / Offer','Shipping / Rush','Warranty / Service','Product Name','Category','Model / Part Number','Brand','Short Description','Processor'].includes(k))),...(p.supplied_details?.notes?.length?{'Supplied pending checks':p.supplied_details.notes.join(' ')}:{})},product_type:p.product_type,
   verification_source:p.verification_source,verified_at:`${p.verified_on}T00:00:00Z`,price_label:p.price_label||'Indicative / reference price',catalogue_note:p.catalogue_update.pricing_note+' Provisional demo inventory: 15 total per model. Exact retail configurations and permissions require approval.',
   variants:variants.map(({v,key},i)=>{
    // STORE identifiers are internal catalogue SKUs, never manufacturer part numbers.
    const approved=(p.variants||[]).find(old=>old.color===v.color&&old.image_permission==='approved')
     || (p.id==='iphone-16'&&v.color==='Ultramarine'&&['128GB','256GB'].includes(v.configuration)
      ? {image_path:'images/products/iphone-16-ultramarine-960.webp',image_source:'https://commons.wikimedia.org/wiki/File:IPhone_16_Ultramarine_Rear.png'}:null)
     || (p.id==='ps5-pro-2tb'&&v.configuration==='Standard configuration'&&v.color==='Colour to confirm'
      ? {image_path:'images/products/ps5-pro-2tb-960.webp',image_source:'https://commons.wikimedia.org/wiki/File:PlayStation_5_Pro_no_disc_drive.jpg'}:null);
    return {id:catalogueID('variant',key),catalogue_key:key,sku:'STORE-'+createHash('sha256').update(key).digest('hex').slice(0,16).toUpperCase(),color:v.color,configuration:v.configuration,price_cents:v.price_cents,price_source:p.catalogue_update.price_source||p.verification_source,price_verified_at:'2026-11-07T00:00:00Z',specifications:{...v.specifications,'SKU origin':'Internal store identifier; manufacturer SKU is not asserted','Price note':v.price_note||p.catalogue_update.pricing_note},quantity:base+(i<remainder?1:0),image_path:approved?.image_path||null,gallery_paths:approved?.gallery_paths||[],image_source:approved?.image_source||(approved?'Existing approved local image record':null),image_permission:approved?'approved':'pending',image_verified_at:approved?'2026-11-07T00:00:00Z':null};
   })};
 })};
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/prepare-persistent-catalogue.mjs')){
 const [products,media]=await Promise.all(['data/products.json','data/owner-image-manifest.json'].map(async p=>JSON.parse(await readFile(p,'utf8'))));
 const manifest=persistentCatalogue(products,media);
 const costs=[{catalogue_key:'ibuypower-ryzen-5-9500f',supplier_cost_cents:130000,note:'Owner revised internal cost, 2026-11-07'}];
 await mkdir('outputs/catalogue-import',{recursive:true});await mkdir('.private/catalogue',{recursive:true});
 await writeFile('outputs/catalogue-import/persistent-catalogue.json',JSON.stringify(manifest,null,2)+'\n');
 await writeFile('.private/catalogue/internal-costs.json',JSON.stringify(costs,null,2)+'\n');
 const quote=value=>"'"+JSON.stringify(value).replaceAll("'","''")+"'::jsonb";
 // Only this ignored SQL file contains the private cost. Never copied to dist.
 const sql='-- Run migration 012_catalogue_inventory.sql first. Transactional, idempotent demo import.\nbegin;\nselect public.import_store_catalogue('+quote(manifest)+','+quote(costs)+');\ncommit;\n';
 await writeFile('.private/catalogue/apply-catalogue.sql',sql);
 console.log(JSON.stringify({models:manifest.products.length,variants:manifest.products.reduce((n,p)=>n+p.variants.length,0),units:manifest.products.reduce((n,p)=>n+p.variants.reduce((a,v)=>a+v.quantity,0),0),hostedWrites:false,privateSQL:'.private/catalogue/apply-catalogue.sql'}));
}
