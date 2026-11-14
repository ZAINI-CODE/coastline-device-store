import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {purchaseLimit,remainingQuantity,wireStepper} from '../js/product-options.js';
import {specificationGroups,specificationsMarkup} from '../js/product-specifications.js';
import {showcaseMarkup,wireShowcase} from '../js/product-showcase.js';
test('purchase limits include existing cart units and fail closed for unknown stock/prices',()=>{
 const p={purchase_limit:4},v={id:'a',stock:6,price_cents:12000};
 assert.equal(purchaseLimit(p,v),4);assert.equal(remainingQuantity(p,v,[{variant_id:'a',quantity:3},{variant_id:'b',quantity:20}]),1);
 for(const bad of [{stock:null},{price_cents:null},{stock:-1},{stock:1.5},{active:false}])assert.equal(purchaseLimit(p,{...v,...bad}),0);
 assert.equal(purchaseLimit({review_only:true},v),0);assert.equal(purchaseLimit(p,{...v,purchase_limit:0}),0);
 assert.equal(remainingQuantity(p,v,[{variant_id:'a',quantity:5}]),0);
});
test('quantity stepper clamps typed values and disables boundary buttons',()=>{
 const input={value:'1',addEventListener(event,fn){this[event]=fn;}},minus={addEventListener(event,fn){this[event]=fn;},dataset:{quantityStep:'-1'}},plus={addEventListener(event,fn){this[event]=fn;},dataset:{quantityStep:'1'}};
 const root={querySelector:s=>s==='input'?input:s.includes('-1')?minus:plus,querySelectorAll:()=>[minus,plus]};let limit=3,n=0;const sync=wireStepper(root,{max:()=>limit,onChange:value=>n=value});
 assert.equal(minus.disabled,true);plus.click();assert.equal(n,2);plus.click();assert.equal(n,3);assert.equal(plus.disabled,true);minus.click();assert.equal(n,2);input.value='999';input.change();assert.equal(n,3);input.value='-2';input.change();assert.equal(n,1);input.value='1.5';input.change();assert.equal(n,1);limit=0;sync();assert.equal(input.disabled,true);assert.equal(plus.disabled,true);
});
test('every imported technical workbook field is retained, variant data overrides matching keys',async()=>{
 const products=JSON.parse(await readFile('data/products.json','utf8'));
 const ignore=['Product Name','Brand','Category','Model / Part Number','Price (as provided)','Original Price','Sale Price','Availability','Short Description','Warranty / Service','Shipping / Rush','Discount / Offer','Other Details'];
 let count=0;for(const p of products){const rows=specificationGroups(p).flatMap(g=>g.rows);for(const [key,value] of Object.entries(p.supplied_details?.raw||{})){if(ignore.includes(key)||!String(value).trim()||/^(n\/a|not applicable|not specified|unknown|pending)$/i.test(value))continue;assert.ok(rows.some(r=>r.label===key&&r.value===String(key==='Processor'&&p.supplied_details?.notes?.some(n=>/NPU/.test(n))?p.specifications.CPU:value)),p.id+' '+key);count++;}}
 assert.ok(count>40);const p={specifications:{Memory:'16GB','Camera':'<script>'}};const groups=specificationGroups(p,{specifications:{Memory:'32GB'}});assert.equal(groups.find(g=>g.title==='Memory & Storage').rows[0].value,'32GB');assert.ok(specificationsMarkup(p,{}).includes('&lt;script&gt;'));
});
test('showcase uses existing matched images and never invents a pending price',()=>{
 const item={id:'test',name:'Test product',brand:'Test',review_only:true,price:null,variants:[{id:'v',image_path:'images/products/test.webp'}]};assert.equal(showcaseMarkup([item]),'');const html=showcaseMarkup([item,{...item,id:'test2'}]);assert.match(html,/Stock not confirmed/);assert.match(html,/data-showcase-pause/);assert.doesNotMatch(html,/\$\d/);
});
test('showcase respects reduced motion, pauses on hover and keeps manual navigation available',()=>{
 const saved=new Map(['window','document','matchMedia','IntersectionObserver','requestAnimationFrame','cancelAnimationFrame'].map(k=>[k,globalThis[k]]));
 const target=()=>({events:new Map(),addEventListener(k,fn){this.events.set(k,fn);},removeEventListener(k){this.events.delete(k);},setAttribute(){}});
 const viewport={...target(),scrollLeft:0,clientWidth:250,scrollBy({left}){this.scrollLeft+=left;}},pause=target(),previous=target(),next=target(),reduced={...target(),matches:true};
 const copy={setAttribute(){},querySelectorAll(){return [];}},set={getBoundingClientRect:()=>({width:500}),cloneNode:()=>copy},track={firstElementChild:set,append(){}};
 const nodes={'.showcase-viewport':viewport,'.showcase-track':track,'[data-showcase-pause]':pause,'[data-showcase-previous]':previous,'[data-showcase-next]':next};
 const root={...target(),isConnected:true,contains:()=>false,querySelector:s=>nodes[s]};let n=0;const frames=new Map(),tick=time=>{const callbacks=[...frames.values()];frames.clear();callbacks.forEach(fn=>fn(time));};let cleanup;
 try{
  globalThis.window=target();globalThis.document={...target(),hidden:false};globalThis.matchMedia=()=>reduced;
  globalThis.IntersectionObserver=class{constructor(fn){this.fn=fn;}observe(){this.fn([{isIntersecting:true}]);}disconnect(){}};
  globalThis.requestAnimationFrame=fn=>{frames.set(++n,fn);return n;};globalThis.cancelAnimationFrame=id=>frames.delete(id);
  cleanup=wireShowcase(root);tick(100);tick(200);assert.equal(viewport.scrollLeft,0);assert.equal(pause.disabled,true);
  next.events.get('click')();assert.equal(viewport.scrollLeft,200);
  reduced.matches=false;reduced.events.get('change')();tick(10000);tick(10016);assert.ok(viewport.scrollLeft>200);
  root.events.get('mouseenter')();const before=viewport.scrollLeft;tick(10032);tick(10048);assert.equal(viewport.scrollLeft,before);
 }finally{cleanup?.();for(const [key,value] of saved)if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
});
