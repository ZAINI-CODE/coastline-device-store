import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {filterProducts} from '../js/core.js';
import {iphoneDeal} from '../js/storefront-ui.js';
import {informationPage} from '../js/content.js';

test('catalogue preserves its source order until sorting is explicitly requested',()=>{
 const products=[{name:'First',featured:false,price:300,variants:[{stock:1}]},{name:'Second',featured:true,price:100,variants:[{stock:1}]}];
 assert.deepEqual(filterProducts(products).map(p=>p.name),['First','Second']);
 assert.deepEqual(filterProducts(products,{sort:'featured'}).map(p=>p.name),['Second','First']);
 assert.deepEqual(filterProducts(products,{sort:'low'}).map(p=>p.name),['Second','First']);
 assert.deepEqual(products.map(p=>p.name),['First','Second']);
});
test('iPhone spotlight uses an existing eligible offer and disappears on expiry or zero stock',()=>{
 const now=Date.parse('2026-11-15T12:00:00Z');
 const product={id:'iphone16',name:'Apple iPhone 16',category:'Apple iPhones',variants:[{id:'variant16',price_cents:100000,stock:2,color:'Blue',configuration:'128GB',images:[{path:'images/products/iphone-16-ultramarine-960.webp'}]}],promotions:[{id:'campaign',name:'Campaign',active:true,kind:'quantity',minimum_quantity:1,discount_cents:0,percent_basis_points:1500,starts_at:'2026-11-11T05:00:00Z',ends_at:'2027-01-02T05:00:00Z',promotion_products:[{product_id:'iphone16',percent_basis_points:1500}]}]};
 const html=iphoneDeal([product],now);assert.match(html,/\$850.00/);assert.match(html,/Save \$150.00/);assert.match(html,/variant16/);
 assert.equal(iphoneDeal([product],Date.parse('2027-01-03T00:00:00Z')),'');
 assert.equal(iphoneDeal([{...product,variants:[{...product.variants[0],stock:0}]}],now),'');
 assert.equal(iphoneDeal([{...product,promotions:[]}],now),'');
});
test('About photos exist and customer copy stays escaped',async()=>{
 const content=JSON.parse(await readFile('config/content.json','utf8'));assert.equal(content.about.images.length,2);
 for(const image of content.about.images)await access(image.path);
 const html=informationPage('about',content,{});assert.match(html,/Quality starts with the details/);assert.match(html,/about-gallery/);assert.doesNotMatch(html,/and processors/);
 const unsafe=informationPage('about',{about:{title:'<script>',paragraphs:['<img>'],sections:[],images:[{path:'https://evil.invalid/x.jpg',alt:'unsafe'}]}},{});assert.match(unsafe,/&lt;script&gt;/);assert.doesNotMatch(unsafe,/src="https:/);
});
