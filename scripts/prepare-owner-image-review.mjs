import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const root='C:/Users/Administrator/OneDrive/Documents/Phone Dataset';
const folders=['iphone models','airbuds','PC/AMD Ryzen Starter Gaming PC'];
const records=[],seen=new Map();
await mkdir('docs/images/owner-review',{recursive:true});await mkdir('images/originals/owner-supplied',{recursive:true});await mkdir('images/products',{recursive:true});
async function exclusive(path,bytes){try{await writeFile(path,bytes,{flag:'wx'});}catch(e){if(e.code!=='EEXIST'||!bytes.equals(await readFile(path)))throw Error('Refusing overwrite: '+path);}}
for(const folder of folders)for(const file of (await readdir(resolve(root,folder))).filter(f=>/\.(avif|webp|png|jpe?g)$/i.test(f)).sort()){
 const relative=folder+'/'+file,bytes=await readFile(resolve(root,relative)),sha=createHash('sha256').update(bytes).digest('hex'),meta=await sharp(bytes).metadata();
 const original=`images/originals/owner-supplied/${sha}${extname(file).toLowerCase()}`;await exclusive(original,bytes);
 const r={file:relative,source_sha256:sha,original_local_path:original,width:meta.width,height:meta.height,permission_status:'commercial_permission_unconfirmed',image_kind:'owner_supplied_product_asset',product_id:null,color:null,angle:/camera|gallery-2/i.test(file)?'detail':/side/i.test(file)?'side':/gallery-1/i.test(file)?'detail':'main',review_status:'pending_match'};
 const name=file.toLowerCase();
 if(folder.startsWith('PC/')){Object.assign(r,{product_id:'ibuypower-ryzen-5-9500f',color:'Black',configuration:'Ryzen 5 9500F / RTX 5050 8GB / 16GB DDR5 / 1TB SSD',match_scope:'Scale case matches supplied configuration; internal components and exact SKU unconfirmed',angle:/dimensions/i.test(file)?'dimensions':/lifestyle/i.test(file)?'lifestyle':/topfront/i.test(file)?'top-front':/side/i.test(file)?'side':'front'});}
 else if(folder==='iphone models'){
  r.product_id=name.startsWith('iphone-18-pro-')?'iphone-18-pro':name.startsWith('iphone-17e-')?'iphone-17e':name.startsWith('iphone-17-')||name==='iphone_17.jpg'?'iphone-17':/iphone[- ]air/.test(name)?'iphone-air':name.startsWith('iphone-duo-')?'iphone-duo':/iphone 16|ihpne 16/.test(name)?'iphone-16':null;
  const colours={'soft-pink':'Soft Pink',cloudwhite:'Cloud White',lightgold:'Light Gold',skyblue:'Sky Blue',spaceblack:'Space Black',nightsky:'Night Sky',starwhite:'Star White',mistblue:'Mist Blue',ultramarine:'Ultramarine',lavender:'Lavender',burgundy:'Burgundy',glacier:'Glacier',silver:'Silver',black:'Black',pink:'Pink',teal:'Teal',white:'White',sage:'Sage'};
  r.color=Object.entries(colours).find(([key])=>name.includes(key))?.[1]||(name==='iphone_17.jpg'?'Lavender':name==='iphone air.jpg'?'Sky Blue':null);
  r.configuration=/128\s?gb/i.test(file)?'128GB':'Storage to confirm';
 }else if(name.startsWith('airpods-pro-3-')){Object.assign(r,{product_id:'airpods-pro-3',color:'White',configuration:'Retail revision to confirm'});}
 else if(name.startsWith('airpods-max2-')){r.review_status='generation_confirmation_required';r.match_note='Filename says Max2 but date 202409 matches 2024 USB-C assets. Do not infer generation from appearance.';}
 else if(name.startsWith('airpods-5-')){Object.assign(r,{product_id:'airpods-5',color:'White',configuration:'Charging case variant to confirm',match_note:'AirPods 5 family verified against Apple US; charging case option pending. Never assigned to AirPods 4.'});}
 if(seen.has(sha)){r.review_status='duplicate';r.duplicate_of=seen.get(sha);}
 else if(Math.max(meta.width,meta.height)<960){r.review_status='low_resolution';}
 else if(r.product_id&&r.color){r.review_status='matched_for_local_review';}
 if(folder.startsWith('PC/')){r.review_status='exact_build_mismatch';r.match_note='Main and side assets show liquid cooling and multiple DIMMs, whereas supplied build specifies AC5 air cooling and one 16GB DIMM. Case-only views cannot verify the exact system. Promotional text appears on the lifestyle asset. No PC asset assigned to the product gallery.';}
 if(!seen.has(sha))seen.set(sha,relative);
 if(r.review_status==='matched_for_local_review'){
  const stem=`images/products/owner-${r.product_id}-${r.color.toLowerCase().replace(/ /g,'-')}-${sha.slice(0,16)}`;
  // Remove only uniform outer padding from full views; retain every product edge and the HD original.
  let input=sharp(bytes).rotate();
  if(meta.width/meta.height>1.5&&r.angle!=='detail'&&r.angle!=='lifestyle'&&r.angle!=='dimensions')input=input.trim({threshold:8});
  const normalized=await input.png().toBuffer(),normalizedMeta=await sharp(normalized).metadata();
  for(const width of [480,960,1600])await exclusive(stem+'-'+width+'.webp',await sharp(normalized).resize({width,withoutEnlargement:true}).webp({quality:92,effort:5}).toBuffer());
  r.path=stem+'-960.webp';r.hd_path=stem+'-1600.webp';r.normalized_width=normalizedMeta.width;r.normalized_height=normalizedMeta.height;
  r.card_eligible=!['detail','dimensions','lifestyle'].includes(r.angle);
 }
 // Inspection copy for AVIF files, which cannot be viewed directly by the review tool.
 if(folder.startsWith('PC/')){r.inspection_path='docs/images/owner-review/'+file.replace(/\.avif$/i,'.jpg');await exclusive(r.inspection_path,await sharp(bytes).resize({width:1200,withoutEnlargement:true}).jpeg({quality:92}).toBuffer());}
 records.push(r);
}
// Preserve separately reviewed ZIP imports if the original folder import is run again.
try {const prior=JSON.parse(await readFile('data/owner-image-manifest.json','utf8'));records.push(...prior.records.filter(r=>r.source_archive_sha256));}catch(error){if(error.code!=='ENOENT')throw error;}
await writeFile('data/owner-image-manifest.json',JSON.stringify({version:1,imported_on:'2026-11-06',scope:'Local frontend review only. No commercial reuse permission inferred. Originals preserved without overwrites.',records},null,2)+'\n');
const research=JSON.parse(await readFile('data/catalogue-expanded-research.json','utf8'));
if(!research.products.some(p=>p.id==='airpods-5'))research.products.push({id:'airpods-5',slug:'airpods-5',name:'Apple AirPods 5',brand:'Apple',category:'Apple Products and Headphones',product_type:'Wireless earbuds',model_number:null,officially_released:true,verified_on:'2026-11-06',source:'https://www.apple.com/shop/buy-airpods/airpods-5',verification_source:'https://www.apple.com/shop/buy-airpods/airpods-5',specifications:{Design:'Open-ear wireless earbuds',Features:'Active Noise Cancellation',Configuration:'Charging case option and exact SKU pending'},description:'AirPods 5 product family, verified in Apple US catalogue. Owner case variant, condition, inventory and sale price are pending.',published:false,active:false,sale_price_cents:null,inventory:null,price_reference:null,image_path:null,variants:[]});
for(const p of research.products){const assets=records.filter(r=>r.product_id===p.id);if(assets.length){p.owner_assets=assets;p.image_review_status=assets.some(r=>r.path)?'local_review_only_permission_pending':'exact_asset_match_pending';}}
research.research_count=research.products.length;research.category_counts=Object.fromEntries(research.categories.map(c=>[c,research.products.filter(p=>p.category===c).length]));
await writeFile('data/catalogue-expanded-research.json',JSON.stringify(research,null,2)+'\n');
console.log(JSON.stringify({files:records.length,matched:records.filter(r=>r.path).length,flags:records.filter(r=>!r.path).map(r=>({file:r.file,status:r.review_status})),pcInspection:records.filter(r=>r.inspection_path).map(r=>r.inspection_path)},null,2));
