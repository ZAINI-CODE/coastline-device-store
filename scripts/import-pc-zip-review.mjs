// Imports only reviewed images from the safely extracted owner ZIP. No backend writes.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {relative,resolve} from 'node:path';
import sharp from 'sharp';
const extraction=JSON.parse((await readFile('docs/images/pc-zip-review/extraction.json','utf8')).replace(/^\uFEFF/,''));
const manifest=JSON.parse(await readFile('data/owner-image-manifest.json','utf8'));
const records=manifest.records.filter(r=>r.source_archive_sha256!==extraction.archive_sha256);
const seen=new Map(records.map(r=>[r.source_sha256,r.file]));
const root=resolve('images/originals/imports');
const mappings=[
 ['AMD Ryzen Starter Gaming PC','ibuypower-ryzen-5-9500f','Ryzen 5 9500F / RTX 5050 8GB / 16GB DDR5 / 1TB SSD'],
 ['Legion Tower 5 Gen 10 30L (AMD) with RTX 5070Ti','lenovo-legion-tower-5-gen-10-rtx-5070-ti','90YJ001LUS / Ryzen 7 7800X3D / RTX 5070 Ti / 32GB / 1TB SSD'],
 ['Nitro 85 Gaming Desktop - N85-100-UR35','acer-nitro-85-n85-100-ur35','N85-100-UR35 / UD.P02AA.07G'],
 ['Prebuilt PC GML 99707','cyberpowerpc-et99707','ET99707 / GML 99707'],
 ['PS5 pro','ps5-pro-2tb','PlayStation 5 Pro / 2TB']
];
async function exclusive(path,bytes){try{await writeFile(path,bytes,{flag:'wx'});}catch(e){if(e.code!=='EEXIST'||!bytes.equals(await readFile(path)))throw Error('Refusing to overwrite '+path);}}
for(const entry of extraction.records){
 const original=resolve(entry.path),rel=relative(root,original);
 if(rel.startsWith('..')||resolve(root,rel)!==original)throw Error('Original outside extracted image directory');
 const bytes=await readFile(original),sha=createHash('sha256').update(bytes).digest('hex');
 if(sha!==entry.sha256)throw Error('Extracted original changed: '+entry.file);
 const folder=entry.file.split('/')[1],name=entry.file.split('/').at(-1);
 const mapping=mappings.find(m=>m[0]===folder);if(!mapping)throw Error('Unreviewed product folder');
 const [_,product_id,configuration]=mapping,meta=await sharp(bytes).metadata();
 const r={file:'Pc Data.zip/'+entry.file,archive_entry:entry.file,source_archive_sha256:extraction.archive_sha256,source_sha256:sha,original_local_path:relative(resolve('.'),original).replaceAll('\\','/'),width:meta.width,height:meta.height,permission_status:'commercial_permission_unconfirmed',image_kind:'owner_supplied_product_asset',product_id,color:product_id==='ps5-pro-2tb'?'White':product_id==='cyberpowerpc-et99707'?'Silver':'Black',configuration,angle:'main',review_status:'pending_match'};
 if(product_id==='ibuypower-ryzen-5-9500f'){
  r.review_status='exact_build_mismatch';r.match_note='Same Scale-case assets previously reviewed: liquid cooling/multiple DIMMs differ from supplied AC5 air cooler/one DIMM; exact SKU unconfirmed. Not displayed.';
 }else if(seen.has(sha)){
  r.review_status='duplicate';r.duplicate_of=seen.get(sha);r.match_note='Byte-identical duplicate; not repeated in the gallery.';
 }else if(Math.max(meta.width,meta.height)<960){
  r.review_status='low_resolution';r.match_note=`Only ${meta.width}×${meta.height}; preserved without enlargement, withheld from the HD product gallery.`;
 }else if(product_id==='lenovo-legion-tower-5-gen-10-rtx-5070-ti'){
  r.review_status='matched_for_local_review';
  r.angle=name==='main pic.avif'?'main':name==='back.avif'?'right-side':name==='fromt.avif'?'rear':name==='logo.avif'?'front-right':'front-left';
  r.source_reference='https://www.lenovo.com/us/en/p/desktops/legion-desktops/legion-t-series-towers/lenovo-legion-tower-5a-gen-10-30l-amd/90yj001lus';
  r.match_note='Supplied Legion Tower 5 Gen 10 30L AMD images match the confirmed model family and black case. Photos alone do not prove internal component part numbers or commercial reuse rights.';
  const stem=`images/products/owner-${product_id}-black-${sha.slice(0,16)}`;
  const normalized=await sharp(bytes).rotate().png().toBuffer(),m=await sharp(normalized).metadata();
  for(const width of [480,960,1600])await exclusive(stem+'-'+width+'.webp',await sharp(normalized).resize({width,withoutEnlargement:true}).webp({quality:92,effort:5}).toBuffer());
  Object.assign(r,{path:stem+'-960.webp',hd_path:stem+'-1600.webp',normalized_width:m.width,normalized_height:m.height,card_eligible:true});
 }
 if(seen.has(sha)&&r.review_status==='exact_build_mismatch')r.duplicate_of=seen.get(sha);
 if(!seen.has(sha))seen.set(sha,r.file);
 records.push(r);
}
manifest.records=records;await writeFile('data/owner-image-manifest.json',JSON.stringify(manifest,null,2)+'\n');
const research=JSON.parse(await readFile('data/catalogue-expanded-research.json','utf8'));
for(const p of research.products){const assets=records.filter(r=>r.product_id===p.id);if(assets.length){p.owner_assets=assets;p.image_review_status=assets.some(r=>r.path)?'local_review_only_permission_pending':'exact_asset_match_pending';}}
await writeFile('data/catalogue-expanded-research.json',JSON.stringify(research,null,2)+'\n');
const imported=records.filter(r=>r.source_archive_sha256===extraction.archive_sha256);
const report={archive:'Pc Data.zip',archive_sha256:extraction.archive_sha256,files_preserved:imported.length,selected:imported.filter(r=>r.path).length,permission:'commercial use unconfirmed; local review only',products:mappings.map(([folder,id])=>({folder,product_id:id,selected:imported.filter(r=>r.product_id===id&&r.path).length,files:imported.filter(r=>r.product_id===id).map(({file,width,height,review_status,match_note,duplicate_of})=>({file,width,height,review_status,match_note,duplicate_of}))}))};
await writeFile('docs/images/pc-zip-review/IMPORT-RESULT.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({archiveFiles:imported.length,selected:report.selected,totalRecords:records.length,totalSelected:records.filter(r=>r.path).length,flags:Object.fromEntries(['matched_for_local_review','duplicate','low_resolution','exact_build_mismatch'].map(s=>[s,imported.filter(r=>r.review_status===s).length]))},null,2));
