import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import{productReviewsMarkup,reviewVisitor}from'../js/product-reviews.js';
import{validReviewReturn,rememberReview,reviewReturn}from'../js/review-navigation.js';
test('review authentication return is product-specific and blocks external redirects',()=>{
 const storage={value:null,getItem(){return this.value;},setItem(k,v){this.value=v;}};
 const product='#/product/3413cf8d-7212-8cfa-a708-1086dce0febd?variant=b5219c26-0e43-86f3-8ad1-0e07e7f6949a';
 const target=rememberReview(storage,product);assert.equal(target,product+'&review=1');assert.equal(reviewReturn(storage,'#/account'),target);
 assert.equal(reviewReturn({getItem:()=>null},'#/account?return='+encodeURIComponent(target)),target);
 for(const value of ['https://evil.invalid','//evil.invalid','#/admin?review=1','#/product/3413cf8d-7212-8cfa-a708-1086dce0febd?review=0'])assert.equal(validReviewReturn(value),null);
 assert.equal(reviewVisitor(storage),reviewVisitor(storage));
});
test('reviews provide prominent action, half stars and likes without reporting or external product links',async()=>{
 const html=productReviewsMarkup([{id:'review',display_name:'Buyer',rating:4.5,body:'Original feedback'}],'eligible');
 assert.ok(html.includes('Add a Review'));assert.ok(html.includes('id="review" class="panel" hidden'));assert.ok(html.includes('value="4.5"'));assert.ok(html.includes('data-like-review="review"'));assert.ok(!/report/i.test(html));
 const app=await readFile('js/app.js','utf8');assert.ok(!app.includes('Manufacturer product details'));assert.ok(!app.includes('available to add'));assert.ok(!app.includes('data-report'));
});
