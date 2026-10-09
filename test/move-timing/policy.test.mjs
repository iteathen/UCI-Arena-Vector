import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const module=await import('../../components/move-timing/policy.mjs').catch(()=>({}));
const sha=text=>createHash('sha256').update(text).digest('hex'),identity=sha('exact selected runtime');
// Logical interface fixture only. These declarations do not establish native
// qualification; no fixture artifact is packaged, signed or used by a Bot.
const declared=()=>({schema:'vector_timing_policy_v1',producer:'vector-evidence-runtime/clock-allocation-v1',runtime_identity_sha256:identity,control:{initial_time_ms:180000,increment_ms:3000},strategy:{kind:'target_blocks_v1',target_blocks:1},useful_blocks_ms:[500],local_publication_reserve_ms:100,unsupported_fallback:'publish-current',qualification:{status:'qualified',study_sha256:sha('study'),discovery_sha256:sha('discovery'),held_out_sha256:sha('heldout'),reserve_sha256:sha('reserve'),allocation:true,useful_blocks:true,clock_safety:true,discovery:{opening_units:8,mean_score_gain:.25,directional_p:.00390625},held_out:{opening_units:8,mean_score_gain:.25,directional_p:.00390625}}});
const admit=value=>module.admitTimingPolicy(JSON.stringify(value),{sha256:sha(JSON.stringify(value)),runtimeIdentitySha256:identity});
const input=extra=>({initialTimeMs:180000,remainingMs:180000,incrementMs:3000,movesToGo:null,explicitLimitMs:null,transportReserveMs:50,elapsedMs:0,applicability:'search_derived',focusIdentity:{rootEpoch:1,requestId:1},...extra});
test('production timing port admits only an exact producer-qualified policy declaration',()=>{
  assert.equal(typeof module.admitTimingPolicy,'function');const handle=admit(declared());assert.ok(Object.isFrozen(handle));assert.equal(handle.diagnostic,false);
  const diagnostic=declared();diagnostic.qualification.status='diagnostic';assert.throws(()=>admit(diagnostic));
  const fixture=declared();fixture.fixture=true;assert.throws(()=>admit(fixture));
  const short=declared();short.qualification.held_out.opening_units=7;assert.throws(()=>admit(short));
  const noBenefit=declared();noBenefit.qualification.held_out.mean_score_gain=0;assert.throws(()=>admit(noBenefit));
  const missingReserve=declared();delete missingReserve.qualification.reserve_sha256;assert.throws(()=>admit(missingReserve));
});
test('supported allocation buys only a full qualified block under hard clock bounds',()=>{
  const handle=admit(declared()),yes=module.decidePolicyPublication(handle,input());assert.equal(yes.publicationDeadlineFromGoMs,500);assert.deepEqual(yes.purchasedBlocksMs,[500]);assert.equal(yes.usefulBlockAuthority,true);assert.equal(yes.diagnostic,false);
  const low=module.decidePolicyPublication(handle,input({remainingMs:400}));assert.equal(low.publicationDeadlineFromGoMs,0);assert.deepEqual(low.purchasedBlocksMs,[]);assert.equal(low.reason,'no_affordable_useful_block');
});
test('unknown initial control and unsupported increment use declared immediate fallback without invented authority',()=>{
  const handle=admit(declared());for(const extra of [{initialTimeMs:0},{incrementMs:0},{movesToGo:40}]){const value=module.decidePolicyPublication(handle,input(extra));assert.equal(value.publicationDeadlineFromGoMs,0);assert.deepEqual(value.purchasedBlocksMs,[]);assert.equal(value.reason,'unsupported_control_publish_current');assert.equal(value.usefulBlockAuthority,false);}
});
test('resolved move bypasses time purchases, exact runtime and whole artifact identity remain required',()=>{
  const policy=declared(),text=JSON.stringify(policy);assert.throws(()=>module.admitTimingPolicy(text,{sha256:sha('other'),runtimeIdentitySha256:identity}));assert.throws(()=>module.admitTimingPolicy(text,{sha256:sha(text),runtimeIdentitySha256:sha('other runtime')}));
  const result=module.decidePolicyPublication(admit(policy),input({applicability:'resolved_without_search_time'}));assert.equal(result.reason,'timing_not_applicable');assert.equal(result.publicationDeadlineFromGoMs,0);
});
