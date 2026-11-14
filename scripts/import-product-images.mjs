// Local-only, non-destructive staging. Never publishes, updates a catalogue, or contacts Supabase.
import {readFile,writeFile,mkdir,stat,realpath} from 'node:fs/promises';
import {resolve,relative,isAbsolute,dirname,extname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const slug=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9-]{0,100}$/.test(value);
function within(root,path){const part=relative(root,path);return part!==''&&!part.startsWith('..')&&!isAbsolute(part);}
async function existingBytes(path){try{return await readFile(path);}catch(error){if(error.code==='ENOENT')return null;throw error;}}
export async function importProductImages({manifest,sourceRoot,workspaceRoot=process.cwd(),products,apply=false}){
 if(manifest.version!==1||!Array.isArray(manifest.images)||manifest.images.length<1||manifest.images.length>1000)throw Error('Use a version 1 manifest containing 1–1000 image records.');
 const source=await realpath(sourceRoot),workspace=resolve(workspaceRoot);
 products??=JSON.parse(await readFile(resolve(workspace,'data/products.json'),'utf8'));
 const planned=[],duplicates=[],seen=new Map(),angles=new Set();
 for(const entry of manifest.images){
  if(!slug(entry.product_id)||!slug(entry.variant_key)||!slug(entry.angle))throw Error('Each image needs an exact product_id, variant_key and angle using lowercase letters, numbers and hyphens.');
  const product=products.find(p=>p.id===entry.product_id);if(!product)throw Error('Unknown product: '+entry.product_id+'. No product will be guessed or created.');
  if(entry.kind!=='photograph')throw Error('Only declared genuine photographs may be staged; rendered/generated images are not accepted.');
  if(typeof entry.color!=='string'||!entry.color.trim()||typeof entry.configuration!=='string'||!entry.configuration.trim())throw Error('Explicit colour and configuration are required.');
  const variant=product.variants?.find(v=>v.variant_key===entry.variant_key)||product.variants?.find(v=>v.color===entry.color&&v.configuration===entry.configuration);
  if(variant&&(variant.color!==entry.color||variant.configuration!==entry.configuration))throw Error('Variant metadata mismatch: '+entry.product_id+'/'+entry.variant_key);
  if(!variant&&entry.allow_new_variant!==true)throw Error('No exact existing variant for '+entry.product_id+'. Explicit allow_new_variant=true stages it for review only.');
  if(typeof entry.file!=='string'||isAbsolute(entry.file)||!/\.(jpe?g|png|webp|avif)$/i.test(entry.file))throw Error('Use a relative path to a supported still image.');
  const lexical=resolve(source,entry.file);if(!within(source,lexical))throw Error('Source path escapes the dataset directory.');
  const path=await realpath(lexical);if(!within(source,path))throw Error('Source symlink escapes the dataset directory.');
  const file=await stat(path);if(!file.isFile()||file.size>25*1024*1024)throw Error('Images must be files no larger than 25 MB.');
  const original=await readFile(path),digest=sha(original),metadata=await sharp(original,{limitInputPixels:64e6}).metadata();
  if(!['jpeg','png','webp','avif','heif'].includes(metadata.format)||(metadata.pages||1)>1)throw Error('Only supported single-frame raster photographs are accepted.');
  if(Math.max(metadata.width||0,metadata.height||0)<960)throw Error('Photograph resolution is below 960 pixels on its longest edge: '+entry.file);
  const identity=entry.product_id+'/'+entry.variant_key,seenAt=seen.get(digest);
  if(seenAt){if(seenAt!==identity)throw Error('The same photograph was assigned to different products or variants.');duplicates.push({file:entry.file,reason:'Identical photograph; not a different angle'});continue;}
  seen.set(digest,identity);
  const angleKey=identity+'/'+entry.angle;if(angles.has(angleKey))throw Error('Duplicate angle key: '+angleKey);angles.add(angleKey);
  const prefix=`images/imports/${entry.product_id}-${entry.variant_key}-${entry.angle}-${digest.slice(0,16)}`;
  const files=[];
  for(const width of [480,960,1600]){
   const bytes=await sharp(original,{limitInputPixels:64e6}).rotate().resize({width,withoutEnlargement:true}).webp({quality:88,effort:6}).toBuffer();
   files.push({path:prefix+'-'+width+'.webp',bytes});
  }
  const originalPath=`images/originals/imported/${digest}${extname(entry.file).toLowerCase()}`;
  files.push({path:originalPath,bytes:original});
  for(const output of files){const target=resolve(workspace,output.path);if(!within(workspace,target))throw Error('Invalid output path.');const before=await existingBytes(target);if(before&&!before.equals(output.bytes))throw Error('Existing file differs; no overwrite permitted: '+output.path);output.exists=Boolean(before);}
  planned.push({entry,files,record:{product_id:entry.product_id,variant_key:entry.variant_key,color:entry.color,configuration:entry.configuration,angle:entry.angle,label:typeof entry.label==='string'?entry.label.slice(0,120):entry.angle,local_path:prefix+'-960.webp',original_local_path:originalPath,source_sha256:digest,source_width:metadata.width,source_height:metadata.height,image_kind:'genuine_photograph',declared_source:entry.source||null,declared_licence:entry.licence||null,permission_status:'pending_review',quality_status:'pending_visual_review',match_status:variant?'existing_variant_matched':'new_variant_pending_review'}});
 }
 const batch=sha(Buffer.from(JSON.stringify(manifest))).slice(0,20),reportPath=`data/image-import-batches/${batch}.json`;
 const report={version:1,batch,staged:apply,published:false,records:planned.map(p=>p.record),duplicates,note:'Staged files only. Inspect every image and confirm exact model/colour/configuration and commercial rights before updating the approved image manifest or product gallery. No existing catalogue/image is overwritten.'};
 if(apply){
  // Validate the entire batch before the first write. Exclusive writes also prevent races.
  for(const plan of planned)for(const output of plan.files)if(!output.exists){const target=resolve(workspace,output.path);await mkdir(dirname(target),{recursive:true});try{await writeFile(target,output.bytes,{flag:'wx'});}catch(error){if(error.code!=='EEXIST'||!(await readFile(target)).equals(output.bytes))throw error;}}
  const target=resolve(workspace,reportPath),before=await existingBytes(target),bytes=Buffer.from(JSON.stringify(report,null,2)+'\n');
  if(before&&!before.equals(bytes))throw Error('Existing import report differs; it will not be overwritten.');
  if(!before){await mkdir(dirname(target),{recursive:true});await writeFile(target,bytes,{flag:'wx'});}
 }
 return {...report,report_path:reportPath,outputs:planned.flatMap(p=>p.files.map(f=>({path:f.path,action:f.exists?'reuse_identical':'create_new'})))};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  const args=process.argv.slice(2),input=args[args.indexOf('--manifest')+1],source=args[args.indexOf('--source')+1];
  if(!args.includes('--manifest')||!args.includes('--source')||!input||!source)throw Error('Usage: node scripts/import-product-images.mjs --manifest dataset.json --source image-folder [--apply]. Default is a read-only dry run.');
  const result=await importProductImages({manifest:JSON.parse(await readFile(resolve(input),'utf8')),sourceRoot:resolve(source),apply:args.includes('--apply')});console.log(JSON.stringify(result,null,2));
 }catch(error){console.error(error.message);process.exitCode=1;}
}
