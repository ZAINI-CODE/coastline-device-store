import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile,access,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join,sep,basename} from 'node:path';
import {productImages,mediaImage,mediaShape} from '../js/product-media.js';
import {resolveTheme} from '../js/theme-state.js';
import {importProductImages} from '../scripts/import-product-images.mjs';
test('theme defaults to white even on dark systems and respects explicit saved choices',()=>{
 assert.equal(resolveTheme(null,true),'light');assert.equal(resolveTheme(null,false),'light');assert.equal(resolveTheme('light',true),'light');assert.equal(resolveTheme('dark',false),'dark');assert.equal(resolveTheme('invalid',true),'light');
});

test('system appearance follows OS preference without changing explicit customer choices',()=>{
 assert.equal(resolveTheme('system',true),'dark');
 assert.equal(resolveTheme('system',false),'light');
 assert.equal(resolveTheme('light',true),'light');
 assert.equal(resolveTheme('dark',false),'dark');
});
test('gallery removes duplicate derivatives and rejects foreign/unapproved variant images',()=>{
 const p={id:'phone',name:'Exact phone',product_type:'Smartphone'},v={color:'Blue',configuration:'128GB',variant_key:'blue-128',images:[
  {path:'images/products/phone-960.webp',label:'Rear',product_id:'phone'},
  {path:'images/products/phone-480.webp',label:'Duplicate size'},
  {path:'images/products/side.webp',label:'Side',product_id:'phone',color:'Blue',configuration:'128GB'},
  {path:'images/products/wrong.webp',product_id:'other'},
  {path:'images/products/red.webp',color:'Red'},
  {path:'images/products/unapproved.webp',permission_status:'pending_review'},
  {path:'images/products/other-variant.webp',variant_key:'blue-256'},
  {path:'images/studio/render.webp'},null
 ]};
 assert.deepEqual(productImages(p,v).map(i=>i.label),['Rear','Side']);assert.equal(mediaShape(p),'portrait');assert.equal(mediaShape({product_type:'Gaming controller'}),'wide');
 const html=mediaImage({path:'images/products/side.webp',alt:'<unsafe>'});assert.ok(html.includes('&lt;unsafe&gt;'));assert.ok(!html.includes('<unsafe>'));
});
test('dataset importer previews, stages idempotently and refuses mismatches/traversal/overwrites',async()=>{
 const root=await mkdtemp(join(tmpdir(),'store-image-import-')),source=join(root,'incoming'),workspace=join(root,'workspace');
 try{
  await mkdir(source);await mkdir(workspace);
  const photo=await readFile('images/products/dualsense-white-960.webp');await writeFile(join(source,'front.webp'),photo);await writeFile(join(source,'duplicate.webp'),photo);
  const products=[{id:'controller',variants:[{color:'White',configuration:'Original',variant_key:'white-original'}]}];
  const image={product_id:'controller',variant_key:'white-original',color:'White',configuration:'Original',angle:'front',file:'front.webp',kind:'photograph'};
  const options={sourceRoot:source,workspaceRoot:workspace,products,manifest:{version:1,images:[image,{...image,file:'duplicate.webp',angle:'rear'}]}};
  const preview=await importProductImages(options);assert.equal(preview.staged,false);assert.equal(preview.records.length,1);assert.equal(preview.duplicates.length,1);await assert.rejects(()=>access(join(workspace,'images')));
  const staged=await importProductImages({...options,apply:true});assert.equal(staged.staged,true);assert.equal(staged.records[0].permission_status,'pending_review');assert.ok(staged.outputs.every(o=>o.path.startsWith('images/imports/')||o.path.startsWith('images/originals/imported/')));
  assert.equal((await importProductImages({...options,apply:true})).outputs[0].action,'reuse_identical');
  await assert.rejects(()=>importProductImages({...options,manifest:{version:1,images:[{...image,color:'Black'}]}}),/mismatch/);
  await assert.rejects(()=>importProductImages({...options,manifest:{version:1,images:[{...image,product_id:'unknown'}]}}),/Unknown product/);
  await assert.rejects(()=>importProductImages({...options,manifest:{version:1,images:[{...image,file:'../outside.webp'}]}}),/escapes/);
  await assert.rejects(()=>importProductImages({...options,manifest:{version:1,images:[{...image,kind:'AI-generated'}]}}),/photographs/);
  await writeFile(join(workspace,staged.outputs[0].path),'preserve existing contents');
  await assert.rejects(()=>importProductImages({...options,apply:true}),/no overwrite permitted/);
  assert.equal(await readFile(join(workspace,staged.outputs[0].path),'utf8'),'preserve existing contents');
 }finally{const target=resolve(root);assert.ok(target.startsWith(resolve(tmpdir())+sep)&&basename(target).startsWith('store-image-import-'));await rm(target,{recursive:true});}
});
