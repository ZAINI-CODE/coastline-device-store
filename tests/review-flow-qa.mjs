// Isolated browser fixture: real public catalogue, mock Auth and disposable reviews/likes.
// No hosted writes, email, payments or credentials are used by this fixture.
import http from 'node:http';import{readFile}from'node:fs/promises';import{resolve,sep,extname}from'node:path';
import{loadLocalEnv}from'../scripts/load-env.mjs';import{publicConfig}from'../scripts/public-config.mjs';
await loadLocalEnv();const config=publicConfig();
const read=async path=>{const response=await fetch(config.supabaseUrl+'/rest/v1/'+path,{headers:{apikey:config.supabaseKey}});if(!response.ok)throw Error('Public fixture lookup failed');return response.json();};
const products=await read('rpc/storefront_catalogue');const reviews=await read('reviews?select=id,product_id,display_name,rating,title,body,created_at,verified_purchase,feedback_source&approved=eq.true');
const user={id:'11111111-1111-4111-8111-111111111122',aud:'authenticated',email:'reviewer@example.invalid',app_metadata:{},user_metadata:{},created_at:new Date().toISOString()};
const part=value=>Buffer.from(JSON.stringify(value)).toString('base64url');const now=Math.floor(Date.now()/1000);
const token=part({alg:'HS256',typ:'JWT'})+'.'+part({sub:user.id,role:'authenticated',iat:now,exp:now+3600})+'.test-signature';
const session={access_token:token,refresh_token:'fixture-refresh-only',token_type:'bearer',expires_in:3600,user};
const pending=[],likes=new Map(),calls=[];const root=resolve('dist');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png','.avif':'image/avif'};
http.createServer(async(req,res)=>{const send=(data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'*','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
try{
 if(req.method==='OPTIONS')return send(null);const url=new URL(req.url,'http://127.0.0.1:4176');
 const raw=await new Promise(done=>{let s='';req.on('data',c=>s+=c);req.on('end',()=>done(s));});const body=raw?JSON.parse(raw):{};
 const authenticated=req.headers.authorization==='Bearer '+token;
 if(url.pathname==='/qa-results')return send({pending,likes:[...likes.entries()].map(([id,v])=>({id,count:v.size})),calls});
 if(url.pathname==='/mobile') {res.writeHead(200,{'Content-Type':'text/html'});return res.end('<!doctype html><title>Mobile fixture</title><iframe title="Store mobile preview" width="390" height="844" src="/'+url.searchParams.get('hash')+'"></iframe>');}
 if(url.pathname==='/config/public.json')return send({supabaseUrl:'http://127.0.0.1:4176',supabaseKey:'qa-public-key',paypalClientId:''});
 if(url.pathname==='/auth/v1/token'){calls.push('sign_in');return send(session);}
 if(url.pathname==='/auth/v1/signup'){calls.push('sign_up');return send({user,session:null});}
 if(url.pathname==='/auth/v1/user')return authenticated?send(user):send({message:'No fixture session'},401);
 if(url.pathname==='/auth/v1/logout')return send({});
 if(url.pathname==='/rest/v1/rpc/storefront_catalogue')return send(products);
 if(url.pathname==='/rest/v1/rpc/has_recent_product_sales')return send(false);
 if(url.pathname==='/rest/v1/rpc/review_eligibility')return send(!authenticated?'sign_in':pending.some(r=>r.product_id===body.p_product)?'submitted':'eligible');
 if(url.pathname==='/rest/v1/rpc/my_product_reviews')return send(authenticated?pending:[]);
 if(url.pathname==='/rest/v1/rpc/submit_review'){
  if(!authenticated)return send({message:'Sign in'},401);if(pending.some(r=>r.product_id===body.p_product))return send({message:'Already submitted'},409);
  pending.push({id:crypto.randomUUID(),product_id:body.p_product,rating:body.p_rating,title:body.p_title,body:body.p_body,display_name:body.p_name,approved:false});calls.push('submit_review');return send(null);
 }
 if(url.pathname==='/rest/v1/rpc/product_review_likes')return send(reviews.filter(r=>r.product_id===body.p_product).map(r=>({review_id:r.id,count:likes.get(r.id)?.size||0,liked:likes.get(r.id)?.has(body.p_visitor)||false})));
 if(url.pathname==='/rest/v1/rpc/like_review'){const set=likes.get(body.p_review)||new Set();set.add(body.p_visitor);likes.set(body.p_review,set);calls.push('like_review');return send({count:set.size,liked:true});}
 if(url.pathname==='/rest/v1/reviews')return send(reviews.filter(r=>r.product_id===url.searchParams.get('product_id')?.slice(3)));
 if(url.pathname==='/rest/v1/store_settings')return send({checkout_enabled:false,policies_approved:false});
 if(url.pathname.startsWith('/rest/v1/'))return send(url.pathname.endsWith('/profiles')?null:[]);
 const path=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!path.startsWith(root+sep))return send({},403);
 let bytes=await readFile(path);if(extname(path)==='.html')bytes=Buffer.from(bytes.toString().replace('<body>','<body><aside role="note">LOCAL TEST: mock accounts; disposable reviews and likes.</aside>'));
 res.writeHead(200,{'Content-Type':types[extname(path)]||'text/plain','Cache-Control':'no-store'});res.end(bytes);
}catch(error){send({message:error.message},500);}}).listen(4176,'127.0.0.1',()=>console.log('Isolated review-flow fixture: http://127.0.0.1:4176 — mock sign-in: reviewer@example.invalid / any 12-character test password.'));
