import assert from 'node:assert/strict';
import test from 'node:test';
import {finishPreparedInitialization,withCompilerLifetime} from '../../components/engine-runtime/preparation-ownership.mjs';
const runtimeClose={graceful:true,driver:{resourceCounts:{live:0,orphaned:0}}};
const preparedClose={status:'complete',failures:[],runtime:runtimeClose};
test('failed post-open initialization closes once and preserves actual retired cleanup plus first cause',async()=>{
 const failure=new Error('initial input rejected');let closes=0;
 const prepared={async close(){closes++;return preparedClose;}};
 await assert.rejects(finishPreparedInitialization(prepared,async()=>{throw failure;}),error=>error===failure&&error.preparationOwnership.state==='retired'&&error.preparationOwnership.receipts[0].cleanup===preparedClose);
 assert.equal(closes,1);
});
test('returned incomplete cleanup is retained as failed ownership and never claimed retired',async()=>{
 const failed={...preparedClose,runtime:{...runtimeClose,graceful:false,driver:{resourceCounts:{live:1,orphaned:0}}}};
 await assert.rejects(finishPreparedInitialization({async close(){return failed;}},async()=>{throw new Error('initial failed');}),error=>error.preparationOwnership.state==='cleanup-failed'&&error.preparationOwnership.receipts[0].cleanup===failed);
});
test('thrown cleanup preserves both causes and does not retry the owned close',async()=>{let closes=0;await assert.rejects(finishPreparedInitialization({async close(){closes++;throw new Error('close failed');}},async()=>{throw new Error('initial failed');}),error=>error instanceof AggregateError&&error.errors.map(e=>e.message).join(',')==='initial failed,close failed'&&error.preparationOwnership.state==='cleanup-failed');assert.equal(closes,1);});
test('compiler work failure retains actual session/runtime retired facts after ordered cleanup',async()=>{const order=[];await assert.rejects(withCompilerLifetime({openRuntime:async()=>({async close(){order.push('runtime');return runtimeClose;}}),work:async(_runtime,ownSession)=>{ownSession({async close(){order.push('session');return {graceful:true};}});throw new Error('compile failed');}}),error=>error.preparationOwnership.state==='retired'&&error.preparationOwnership.receipts[0].cleanup.runtime===runtimeClose);assert.deepEqual(order,['session','runtime']);});
test('compiler session close failure retains runtime ownership and never declares clean retirement',async()=>{let runtimeCloses=0;await assert.rejects(withCompilerLifetime({openRuntime:async()=>({async close(){runtimeCloses++;return runtimeClose;}}),work:async(_runtime,ownSession)=>{ownSession({async close(){return {graceful:false};}});return 'artifact';}}),error=>error.preparationOwnership.state==='cleanup-failed');assert.equal(runtimeCloses,0);});
test('runtime open rejection has unknown ownership rather than fabricated not-opened proof',async()=>{await assert.rejects(withCompilerLifetime({openRuntime:async()=>{throw new Error('factory rejected without report');},work:async()=>{assert.fail('must not execute');}}),error=>error.preparationOwnership.state==='unknown'&&error.preparationOwnership.receipts.length===0);});
