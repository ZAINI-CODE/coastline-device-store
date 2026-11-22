import test from 'node:test';
import assert from 'node:assert/strict';
import {orderCard,orderHistoryMarkup,orderItemImage,orderStatus} from '../js/order-history.js';

const variant={id:'variant-blue',color:'Blue',configuration:'256GB',image_path:'images/products/iphone-16-black-960.webp',gallery_paths:[]};
const products=[{id:'phone',name:'Current catalogue name',variants:[variant]}];
const item={product_id:'phone',variant_id:'variant-blue',product_name:'Recorded product name',variant:'Blue / 256GB',quantity:2,unit_price_cents:188895};
const order={id:'66666666-6666-4666-8666-666666666666',created_at:'2026-11-14T08:50:00Z',status:'payment_pending',payment_status:'processing',method:'zelle',total_cents:163061,shipping_address:{full_name:'Local test recipient',line1:'100 Example Street',line2:'Unit 2',city:'Miami',state:'FL',postal_code:'33101',country:'US'},order_items:[item],order_status_history:[]};

test('history keeps recorded totals, quantities, variants and recipient instead of current catalogue prices',()=>{
 const html=orderCard(order,products);
 assert.match(html,/\$1,630\.61/);assert.match(html,/\$1,888\.95/);
 assert.match(html,/Recorded product name/);assert.doesNotMatch(html,/Current catalogue name/);
 assert.match(html,/Quantity: <strong>2<\/strong>/);assert.match(html,/Blue \/ 256GB/);
 assert.match(html,/Unit 2/);assert.match(html,/Payment pending/);assert.match(html,/Processing/);
 assert.match(html,/Tracking has not been added yet/);assert.match(html,/Review order &amp; payment|Review order & payment/);
 assert.doesNotMatch(html,/Payment received|Delivered|Order confirmed/);
});

test('photos require exact product, variant and historical configuration identity',()=>{
 assert.equal(orderItemImage(item,products)?.path,variant.image_path);
 for(const change of [{product_id:'other'},{variant_id:'other'},{variant:'Red / 128GB'}]){
  assert.equal(orderItemImage({...item,...change},products),null);
  assert.doesNotMatch(orderCard({...order,order_items:[{...item,...change}]},products),/<img /);
 }
});

test('tracking and status history render actual records without reordering the source or adding events',()=>{
 const history=[{created_at:'2026-11-17T15:00:00Z',status:'shipped',payment_status:'paid'},{created_at:'2026-11-15T10:00:00Z',status:'processing',payment_status:'paid'}];
 const snapshot=structuredClone(history);
 const html=orderCard({...order,status:'shipped',payment_status:'paid',carrier:'UPS',tracking_number:'LOCAL-TRACKING-ONLY',order_status_history:history});
 assert.match(html,/UPS/);assert.match(html,/LOCAL-TRACKING-ONLY/);
 assert.doesNotMatch(html,/Review order & payment|Tracking has not been added|Delivered/);
 assert.ok(html.indexOf('2026-11-15T10:00:00.000Z')<html.indexOf('2026-11-17T15:00:00.000Z'));
 assert.deepEqual(history,snapshot);
 assert.doesNotMatch(orderCard({...order,stock_released:true}),/Review order & payment/);
});

test('customer text is escaped, dates fail safely, and unknown statuses never imply success',()=>{
 const html=orderCard({...order,id:'<bad>',created_at:null,carrier:'<script>',tracking_number:'<img onerror=bad>',shipping_address:{full_name:'<svg onload=bad>'},order_items:[{...item,product_name:'<script>alert(1)</script>'}]});
 assert.doesNotMatch(html,/<script>|<svg onload|<img onerror/);assert.match(html,/&lt;script&gt;/);assert.match(html,/Date unavailable/);
 assert.equal(orderStatus('unrecognized').tone,'neutral');assert.equal(orderStatus('pending').tone,'waiting');assert.equal(orderStatus('paid').tone,'success');
 assert.match(orderHistoryMarkup([]),/Your first order starts here/);
 assert.match(orderHistoryMarkup([order]),/id="order-history"/);
});
