// Uses the local QA server only. No hosted order, profile or payment is written.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const rows=JSON.parse(await fs.readFile(process.env.QA_CATALOGUE_FILE||'.private/redesign/catalogue.json','utf8'));
const product=rows.find(p=>p.name==='Apple iPhone Duo')||rows[0],variant=product.variants[0];
const item={product_id:product.id,variant_id:variant.id,product_name:product.name,variant:[variant.color,variant.configuration].filter(Boolean).join(' / '),quantity:1,unit_price_cents:188895};
const order={id:'66666666-6666-4666-8666-666666666666',created_at:'2026-11-14T08:50:00Z',status:'payment_pending',payment_status:'processing',method:'zelle',total_cents:163061,stock_released:false,shipping_address:{full_name:'Local UI Customer',line1:'100 Example Street',line2:'Unit 2',city:'Miami',state:'FL',postal_code:'33101',country:'US'},order_items:[item],order_status_history:[{created_at:'2026-11-14T08:50:00Z',status:'payment_pending',payment_status:'pending'},{created_at:'2026-11-14T08:55:00Z',status:'payment_pending',payment_status:'processing'}]};
const orders=[order,{...order,id:'77777777-7777-4777-8777-777777777777',status:'shipped',payment_status:'paid',carrier:'UPS',tracking_number:'LOCAL-TRACKING-ONLY',order_items:[item,{...item,variant_id:'removed-variant',variant:'Historical configuration',quantity:2}]},{...order,id:'88888888-8888-4888-8888-888888888888',status:'cancelled',payment_status:'cancelled',stock_released:true}];
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,headless:true}),context=await browser.newContext({viewport:{width:1440,height:1050},reducedMotion:'reduce'}),page=await context.newPage();
const results=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
await context.grantPermissions(['clipboard-read','clipboard-write']);
await fs.mkdir('.private/order-history',{recursive:true});
await page.route('**/rest/v1/orders?**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(orders)}));
const check=async(name,fn)=>{try{await fn();results.push({name,status:'PASS'});console.log('PASS',name);}catch(e){results.push({name,status:'FAIL',error:e.message});console.log('FAIL',name,e.message.slice(0,240));}};
const fits=async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal overflow');
async function screenshot(name){await page.locator('#order-history').evaluate(el=>el.scrollIntoView({block:'start'}));await page.screenshot({path:'.private/order-history/'+name+'.jpg',type:'jpeg',quality:90,animations:'disabled'});}
try{
 await page.goto('http://127.0.0.1:4174/#/account');await page.locator('#login').waitFor();
 await page.locator('#login [name=email]').fill('owner@qa.invalid');await page.locator('#login [name=password]').fill('Local-Only-Password123!');await page.locator('#login>.button').click();await page.locator('.order-card').first().waitFor();
 await check('Desktop: stored order details, exact image and independent status badges',async()=>{assert.equal(await page.locator('.order-card').count(),3);const card=page.locator('.order-card').first();assert.match(await card.locator('.order-total').textContent(),/1,630.61/);assert.match(await card.locator('.order-badge').allTextContents().then(x=>x.join(' / ')),/Payment pending.*Processing/);assert.equal(await card.locator('.order-product-image').count(),1);await card.locator('img').evaluate(img=>img.decode());assert.equal(await card.locator('.order-payment-link').count(),1);assert.equal(await page.locator('.order-card').nth(1).locator('.order-payment-link').count(),0);assert.equal(await page.locator('.order-card').nth(2).locator('.order-payment-link').count(),0);await fits();await screenshot('desktop-light');});
 await check('Copy order ID',async()=>{await page.locator('.order-copy').first().click();await page.getByText('Order ID copied.',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),order.id);});
 await check('Order timeline, address line 2 and recorded tracking',async()=>{await page.locator('.order-timeline summary').first().click();assert.equal(await page.locator('.order-timeline').first().locator('li').count(),2);assert.match(await page.locator('.order-address').first().textContent(),/Unit 2/);assert.match(await page.locator('.order-tracking-details').textContent(),/UPS.*LOCAL-TRACKING-ONLY/s);assert.equal(await page.locator('.order-card').nth(1).locator('.order-product-symbol').count(),1);});
 await check('Dark theme',async()=>{await page.locator('select[data-theme-mode]').selectOption('dark');await fits();await screenshot('desktop-dark');});
 for(const width of [393,320])await check('Responsive layout at '+width+'px',async()=>{await page.setViewportSize({width,height:852});await fits();await page.locator('.order-card').nth(1).scrollIntoViewIfNeeded();await fits();await screenshot('mobile-'+width);});
 await page.locator('select[data-theme-mode]').selectOption('light');await page.setViewportSize({width:393,height:852});await screenshot('mobile-light');
 await check('Review order/payment retains original route',async()=>{await page.locator('.order-payment-link').first().click();await page.waitForURL('**/#/checkout?order='+order.id);await page.locator('#payment').waitFor();assert.equal(await page.locator('main[data-page=checkout]').count(),1);});
 await check('Empty account history',async()=>{await page.unroute('**/rest/v1/orders?**');await page.route('**/rest/v1/orders?**',route=>route.fulfill({status:200,contentType:'application/json',body:'[]'}));await page.goto('http://127.0.0.1:4174/#/account');await page.locator('.order-history-empty').waitFor();assert.equal(await page.locator('.order-card').count(),0);await fits();});
 assert.deepEqual(errors,[]);
}finally{await fs.writeFile('.private/order-history/browser-results.json',JSON.stringify({results,errors},null,2));await browser.close();}
if(errors.length||results.some(r=>r.status==='FAIL'))process.exitCode=1;
