// Disposable browser fixture. Never connects to Supabase or accepts payments.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {ownerPreviewProducts} from '../js/owner-catalogue-preview.js';
const drafts=JSON.parse(await readFile('data/products.json','utf8')),manifest=JSON.parse(await readFile('data/owner-image-manifest.json','utf8'));
const source=ownerPreviewProducts(drafts,manifest).find(p=>p.id==='iphone-16');
const variants=source.variants.map((v,i)=>({...v,id:`11111111-1111-4111-8111-${String(i+1).padStart(12,'0')}`,sku:`LOCAL-TEST-${i+1}`,active:true,image_permission:'approved',price_cents:10000+i*1000,inventory:{quantity:i===2?0:i===1?2:3},specifications:{Memory:'TEST VALUE ONLY'}}));
const product={...source,id:'22222222-2222-4222-8222-222222222222',name:'LOCAL TEST ONLY — iPhone controls',review_only:false,owner_image_review:false,reference_price:null,published:true,purchase_limit:3,categories:{name:source.category},product_variants:variants,reviews:[]};
// The fixture changes only IDs. Image metadata must follow that test ID.
for(const v of variants)for(const image of v.images)image.product_id=product.id;
const publicProduct={id:product.id,name:product.name,brand:product.brand,description:product.description,category:source.category,product_type:product.product_type,specifications:product.specifications,variants:variants.map(v=>({id:v.id,color:v.color,configuration:v.configuration,price_cents:v.price_cents,stock:v.inventory.quantity,image_path:v.images[0]?.path??null,gallery_paths:v.images.slice(1).map(i=>i.path),specifications:v.specifications})),review_count:0};
const root=resolve('dist'),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp'};
http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://127.0.0.1:4176');res.setHeader('Cache-Control','no-store');
 const json=(value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
 if(url.pathname==='/rest/v1/rpc/storefront_catalogue'&&req.method==='POST')return json([publicProduct]);
 if(req.method!=='GET')return json({error:'Read-only local fixture'},405);
 if(url.pathname==='/config/public.json')return json({supabaseUrl:'http://127.0.0.1:4176',supabaseKey:'local-test-public-key',paypalClientId:''});
 if(url.pathname==='/rest/v1/reviews')return json([]);
 if(url.pathname.startsWith('/rest/v1/'))return json([]);
 if(url.pathname.startsWith('/auth/'))return json({message:'No live authentication in local fixture'},401);
 const base=/^\/images\/products\/owner-[\w.-]+\.webp$/.test(url.pathname)?resolve('.'):root;
 const path=resolve(base,'.'+decodeURIComponent(url.pathname));if(path!==base&&!path.startsWith(base+sep))return json({},403);
 const file=path===root?resolve(root,'index.html'):path;let bytes=await readFile(file);if(extname(file)==='.html')bytes=Buffer.from(bytes.toString().replace('<body>','<body><aside class="qa-banner">LOCAL TEST FIXTURE — artificial prices and inventory, no real services or payments</aside>'));
 res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'});res.end(bytes);
}catch{res.writeHead(404);res.end('Not found');}}).listen(4176,'127.0.0.1',()=>console.log('Disposable UI fixture: http://127.0.0.1:4176'));
