// Downloads genuine open-licensed candidate photographs for local visual review.
// Research files are never deployed automatically; approval lives in image-manifest.json.
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const candidates=[
 ['dualsense-white-hd','Playstation DualSense Controller.png'],
 ['iphone-16-ultramarine-back','Back view of iPhone 16 Ultramarine.jpg'],
 ['dualsense-edge','DualSense Edge Controller.jpg'],
 ['dualsense-midnight-black','Playstation 5 DualSense controller in Midnight Black, 2026-02-07 (front).jpg'],
 ['ps5-alternative','Immagine Playstation 5.jpg'],
 ['airpods-comparison','AirPods 4 and AirPods Pro 2.jpg']
];
await mkdir('images/research',{recursive:true});await mkdir('docs/images',{recursive:true});
const evidence=[];
for(const [slug,title] of candidates){
 const page='https://commons.wikimedia.org/wiki/File:'+encodeURIComponent(title.replaceAll(' ','_'));
 try{
  const api=new URL('https://commons.wikimedia.org/w/api.php');
  api.search=new URLSearchParams({action:'query',format:'json',prop:'imageinfo',iiprop:'url|extmetadata',titles:'File:'+title});
  const response=await fetch(api,{signal:AbortSignal.timeout(30000),headers:{'User-Agent':'ElectronicsStoreImageResearch/1.0'}});if(!response.ok)throw Error('Metadata HTTP '+response.status);
  const data=await response.json(),info=Object.values(data.query.pages)[0].imageinfo[0],meta=info.extmetadata,licence=meta.LicenseShortName?.value;
  if(!/^(CC BY(-SA)? [234]\.0|CC0|Public domain)$/.test(licence))throw Error('Commercial licence requires manual review: '+licence);
  const image=await fetch(info.url,{signal:AbortSignal.timeout(30000),headers:{'User-Agent':'ElectronicsStoreImageResearch/1.0'}});if(!image.ok)throw Error('Image HTTP '+image.status);
  const bytes=Buffer.from(await image.arrayBuffer()),size=await sharp(bytes).metadata();
  await writeFile('images/research/'+slug+'.'+(size.format==='jpeg'?'jpg':size.format),bytes);
  await sharp(bytes).rotate().resize({width:960,withoutEnlargement:true}).webp({quality:88}).toFile('images/research/'+slug+'-review.webp');
  evidence.push({slug,title,source:page,download_url:info.url,licence,licence_url:meta.LicenseUrl?.value,author_html:meta.Artist?.value,credit_html:meta.Credit?.value,width:size.width,height:size.height,sha256:createHash('sha256').update(bytes).digest('hex'),checked_on:'2026-11-03',status:'awaiting_visual_review'});
  console.log(slug,licence,size.width+'x'+size.height);
 }catch(error){evidence.push({slug,title,source:page,status:'blocked',reason:error.message});console.log(slug,error.message);}
}
await writeFile('docs/images/download-review.json',JSON.stringify(evidence,null,2)+'\n');
