import test from 'node:test';
import assert from 'node:assert/strict';
import {accountActionsMarkup,reviewProductRoute} from '../js/account-actions.js';

const id='3413cf8d-7212-8cfa-a708-1086dce0febd';
test('review entry preserves the product route and rejects malformed or injected destinations',()=>{
 assert.equal(reviewProductRoute(id),'/product/'+id+'?review=1');
 for(const value of [null,'https://elsewhere.invalid','../account',id+'#redirect',id+'<script>'])assert.equal(reviewProductRoute(value),null);
});
test('product picker escapes names, marks existing submissions and keeps sign-out confirmation explicit',()=>{
 const html=accountActionsMarkup([{id,name:'<unsafe product>'}],[{product_id:id,approved:false}]);
 assert.doesNotMatch(html,/<unsafe product>/);assert.match(html,/already submitted reviews/);
 const available=accountActionsMarkup([{id,name:'<unsafe product>'},{id:'other',name:'Another product'}],[{product_id:id}]);
 assert.match(available,/&lt;unsafe product&gt; · Review already submitted/);assert.match(available,new RegExp('value="'+id+'" disabled'));
 assert.match(html,/Are you sure you want to sign out/);assert.match(html,/data-close-account-dialog autofocus>Stay signed in/);
 assert.match(accountActionsMarkup([],[],false),/class="account-review-action" hidden/);
});
