import test from 'node:test';import assert from 'node:assert/strict';import {orderActionIntent} from '../js/action-styles.js';
test('admin order colour follows the selected operation rather than treating cancellation as confirmation',()=>{
 for(const action of ['cancel','cancel_zelle','refund'])assert.equal(orderActionIntent(action),'destructive');
 for(const action of ['verify_zelle','processing','shipped','delivered'])assert.equal(orderActionIntent(action),'positive');
 assert.equal(orderActionIntent('unknown'),'general');
});
