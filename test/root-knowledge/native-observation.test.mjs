import test from 'node:test';
import assert from 'node:assert/strict';
const api=await import('./native-observation.mjs').catch(()=>({}));
const selection={schema:'vector_root_tablebase_selection_v1',componentId:'syzygy.root-provider',version:'2.1.0',manifestSha256:'942b7552dbe28479cf1fa08c45e439ab50546f8efac1e9551ebda770a5e3484f',contractSha256:'0c3863989e3fd596e4216f029b8ad691a04dd499daf563828a819b0bc72be83a'};
test('native observation binds final08 and v2 canonical config without equating file bytes',()=>{
 assert.equal(typeof api.bindingObservation,'function');
 const compact=Buffer.from('{"b":2,"a":1}'),pretty=Buffer.from('{\n "a": 1, "b": 2\n}\n');
 const a=api.bindingObservation({selection,providerRoot:'C:/provider/runtime',configPath:'C:/managed/config.json',configBytes:compact}),b=api.bindingObservation({selection,providerRoot:'C:/provider/runtime',configPath:'C:/managed/config.json',configBytes:pretty});
 assert.equal(a.binding.schema,'vector_root_tablebase_binding_v2');assert.equal(a.binding.configuration.canonicalSha256,b.configuration.canonicalSha256);assert.notEqual(a.configuration.sha256,b.configuration.sha256);assert.equal(a.bindingBytesSha256,b.bindingBytesSha256);
 assert.equal(a.providerSelection.providerSource,'c254e225219f4805f3997e967000b4d802556282');
 assert.throws(()=>api.bindingObservation({selection:{...selection,manifestSha256:'a'.repeat(64)},providerRoot:'C:/provider/runtime',configPath:'C:/managed/config.json',configBytes:compact}),/final08/);
});
const joined=()=>({joined:true,semantic:{fields:{stopCause:2,drainDisposition:0,activeWorkLease:0,backupPhase:0,pathProtections:0,evaluatorProtections:0,evaluatorRequestState:0,evaluatorBatchState:0,activePathOccurrences:0,edgeLeaseClaims:1,edgeLeaseReleases:1,workLeaseClaims:1,workLeaseReleases:1},acceptedCancel:{id:[1,0,0,0],generation:[2,0,0,0]}},cleanup:{status:'complete',failures:[],runtime:{graceful:true,driver:{resourceCounts:{live:0,orphaned:0}}}}});
test('native managed closure rejects dirty driver, first cause, drain and missing accepted cancel independently',()=>{
 assert.equal(typeof api.assertJoinedObservation,'function');assert.doesNotThrow(()=>api.assertJoinedObservation(joined()));
 for(const change of [r=>r.joined=false,r=>r.semantic.fields.stopCause=8,r=>r.semantic.fields.drainDisposition=9,r=>r.cleanup.runtime.driver.resourceCounts.orphaned=1,r=>r.semantic.acceptedCancel.id=[0,0,0,0],r=>r.semantic.fields.workLeaseReleases=0]){const r=joined();change(r);assert.throws(()=>api.assertJoinedObservation(r));}
});
test('normal external closure requires actual same generation, drained worker, normal process EOF',()=>{
 assert.equal(typeof api.assertExternalObservation,'function');const value=()=>({provider:{status:'closed',drained:true,failed:false,provider_generation:'1'.repeat(32)},process:{code:0,signal:null,forced:false}});
 assert.doesNotThrow(()=>api.assertExternalObservation(value(),'1'.repeat(32)));
 for(const change of [r=>r.provider.drained=false,r=>r.provider.provider_generation='2'.repeat(32),r=>r.process.code=4,r=>r.process.forced=true,r=>r.process.signal='SIGTERM']){const r=value();change(r);assert.throws(()=>api.assertExternalObservation(r,'1'.repeat(32)));}
});
