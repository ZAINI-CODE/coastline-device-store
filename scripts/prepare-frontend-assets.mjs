import {readFile,writeFile,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
await copyFile('images/research/dualsense-white-hd.png','images/originals/dualsense-white-original.png');
await copyFile('images/research/dualsense-edge.jpg','images/originals/dualsense-edge-original.jpg');
const manifest=JSON.parse(await readFile('data/image-manifest.json','utf8'));
const white=manifest.find(m=>m.product_id==='dualsense-original-white');
white.modifications='Resized and converted from the full-resolution 3120 × 2760 original to WebP. No model, colour or background changes. Derivatives offered under CC BY-SA 4.0';
white.note='Full-resolution original downloaded on 2026-11-03; derivatives never enlarged.';
const edge={product_id:'dualsense-edge',database_product_id:null,product_name:'Sony DualSense Edge wireless controller',variant:'White, DualSense Edge; not the standard DualSense',filename:'dualsense-edge-960.webp',local_path:'images/products/dualsense-edge-960.webp',original_local_path:'images/originals/dualsense-edge-original.jpg',original_source:'https://commons.wikimedia.org/wiki/File:DualSense_Edge_Controller.jpg',author:'Sonson2',licence:'CC0 1.0',licence_url:'https://creativecommons.org/publicdomain/zero/1.0/',permission_status:'approved',quality_status:'approved',modifications:'Resized and converted to WebP; no model, colour or background changes. Never enlarged.',verification_date:'2026-11-03',width_variants:[480,960,1600]};
if(!manifest.some(m=>m.product_id===edge.product_id))manifest.push(edge);
for(const m of manifest.filter(m=>m.local_path)){
 m.verification_date='2026-11-03';m.image_kind='genuine_photograph';
 const original=await readFile(m.original_local_path),meta=await sharp(original).metadata();
 m.source_sha256=createHash('sha256').update(original).digest('hex');m.source_width=meta.width;m.source_height=meta.height;
 const stem=m.local_path.replace(/-960\.webp$/,'');
 for(const width of m.width_variants)await sharp(original).rotate().resize({width,withoutEnlargement:true}).webp({quality:88,effort:6}).toFile(stem+'-'+width+'.webp');
}
await writeFile('data/image-manifest.json',JSON.stringify(manifest,null,2)+'\n');
const drafts=JSON.parse(await readFile('data/products.json','utf8'));
if(!drafts.some(p=>p.id==='dualsense-edge'))drafts.push({id:'dualsense-edge',name:edge.product_name,brand:'Sony',category:'Gaming Controllers',product_type:'Controller',model_number:null,published:false,status:'pending_owner_inventory_price_and_exact_retail_model',description:'DualSense Edge wireless controller in white. This is a distinct controller from the standard DualSense.',specifications:{Colour:'White'},verification_source:'https://www.playstation.com/en-us/accessories/dualsense-edge-wireless-controller/',verified_on:'2026-11-03',variants:[{color:'White',configuration:'DualSense Edge',sku:null,price_cents:null,inventory:null,active:false,image_path:edge.local_path,image_permission:'approved'}]});
await writeFile('data/products.json',JSON.stringify(drafts,null,2)+'\n');
console.log('Four exact-family genuine photographs prepared; all sale prices and stock remain unconfigured.');
