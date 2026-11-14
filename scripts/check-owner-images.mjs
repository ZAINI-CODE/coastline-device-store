import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {ownerPreviewProducts} from '../js/owner-catalogue-preview.js';
import {productImages} from '../js/product-media.js';
const manifest=JSON.parse(await readFile('data/owner-image-manifest.json','utf8')),products=JSON.parse(await readFile('data/products.json','utf8'));
const preview=ownerPreviewProducts(products,manifest),selected=manifest.records.filter(r=>r.path);
for(const r of manifest.records){const original=await readFile(r.original_local_path);if(createHash('sha256').update(original).digest('hex')!==r.source_sha256)throw Error('Original changed: '+r.file);}
for(const r of selected)for(const size of [480,960,1600]){const path=r.path.replace('-960.webp',`-${size}.webp`),m=await sharp(path).metadata();if(m.width>Math.min(size,r.normalized_width)||Math.abs(m.width/m.height-r.normalized_width/r.normalized_height)>.02)throw Error('Upscale/distortion '+path);await readFile('dist/'+path);}
for(const p of preview)for(const v of p.variants){const images=productImages(p,v);if(images.length!==v.images.length||images.some(i=>i.product_id!==p.id||i.color!==v.color))throw Error('Variant gallery mismatch');}
const esc=s=>s.replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
for(let start=0;start<selected.length;start+=12){const group=selected.slice(start,start+12),tiles=[];
 for(let i=0;i<group.length;i++){const r=group[i],x=i%3*400,y=Math.floor(i/3)*280;tiles.push({input:await sharp(r.path).resize({width:380,height:230,fit:'contain',background:'#f6f6f8'}).png().toBuffer(),left:x+10,top:y+5});tiles.push({input:Buffer.from(`<svg width="400" height="40"><rect width="400" height="40" fill="white"/><text x="8" y="15" font-size="12" font-family="Arial">${esc(r.product_id+' / '+r.color)}</text><text x="8" y="31" font-size="12" font-family="Arial">${esc(r.angle+' / '+r.source_sha256.slice(0,12))}</text></svg>`),left:x,top:y+235});}
 await sharp({create:{width:1200,height:Math.ceil(group.length/3)*280,channels:3,background:'#fff'}}).composite(tiles).jpeg({quality:92}).toFile(`docs/images/owner-review/contact-${start/12+1}.jpg`);
}
await writeFile('docs/images/OWNER-IMAGE-REVIEW.json',JSON.stringify({checked_on:'2026-11-06',original_files_preserved:manifest.records.length,selected_images:selected.length,review_product_count:preview.length,review_variants:preview.reduce((n,p)=>n+p.variants.length,0),published_products:0,commercial_permission:'unconfirmed',withheld:manifest.records.filter(r=>!r.path).map(({file,review_status,match_note,duplicate_of})=>({file,review_status,match_note,duplicate_of})),missing_requested_gaming_images:preview.filter(p=>p.featured&&!p.variants.some(v=>v.images.length)).map(p=>p.id)},null,2)+'\n');
console.log(JSON.stringify({originals:manifest.records.length,selected:selected.length,products:preview.length,variants:preview.reduce((n,p)=>n+p.variants.length,0),contactSheets:Math.ceil(selected.length/12)}));
