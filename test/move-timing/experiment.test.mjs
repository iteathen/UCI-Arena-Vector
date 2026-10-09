import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const module = await import('../../components/move-timing/experiment.mjs').catch(()=>({}));
const digest = text=>createHash('sha256').update(text).digest('hex');
const identity=digest('exact physical cohort');
const candidate=(kind='target_blocks_v1')=>({schema:'vector_timing_experiment_v1',diagnostic:true,campaign_id:'clock-discovery-180+3',runtime_identity_sha256:identity,rules_profile:'orthodoxy-live-claims-v1',strategy:{kind,target_blocks:2,...(kind==='preserve_future_blocks_v1'?{future_decisions:8}:{})},candidate_blocks_ms:[500,500],local_publication_reserve_ms:100,supported_inputs:{initial_time_ms:180000,increment_ms:3000},qualification:{timing:false,strength:false,useful_blocks:false,publication:false}});
const admit=value=>module.admitTimingExperiment(JSON.stringify(value),{sha256:digest(JSON.stringify(value)),runtimeIdentitySha256:identity});
const input=extra=>({initialTimeMs:180000,remainingMs:180000,incrementMs:3000,movesToGo:null,explicitLimitMs:null,transportReserveMs:50,elapsedMs:0,applicability:'search_derived',focusIdentity:{rootEpoch:1,requestId:1},...extra});
test('public diagnostic experiment port exists without granting production timing authority',()=>{
  assert.equal(typeof module.admitTimingExperiment,'function');
  const handle=admit(candidate());assert.equal(handle.diagnostic,true);assert.equal(handle.qualification.useful_blocks,false);
  assert.ok(Object.isFrozen(handle));assert.ok(Object.isFrozen(handle.strategy));
});
test('exact cohort, bytes and diagnostic disposition are mandatory',()=>{
  assert.throws(()=>module.admitTimingExperiment(JSON.stringify(candidate()),{sha256:digest('different'),runtimeIdentitySha256:identity}),/digest/);
  assert.throws(()=>module.admitTimingExperiment(JSON.stringify(candidate()),{sha256:digest(JSON.stringify(candidate())),runtimeIdentitySha256:digest('other')}),/identity/);
  for(const mutation of [v=>v.diagnostic=false,v=>v.qualification.useful_blocks=true,v=>v.strategy.depth=4,v=>v.candidate_blocks_ms=[0],v=>v.extra=true]){const v=candidate();mutation(v);assert.throws(()=>admit(v));}
});
test('discretionary candidate blocks cannot breach the remaining-clock hard reserve',()=>{
  const handle=admit(candidate());const decision=module.decideExperimentalPublication(handle,input({remainingMs:900}));
  assert.equal(decision.publicationDeadlineFromGoMs,500);assert.deepEqual(decision.purchasedBlocksMs,[500]);
  assert.equal(decision.reason,'next_candidate_block_unaffordable');assert.equal(decision.safeEnvelopeFromGoMs,750);
  const emergency=module.decideExperimentalPublication(handle,input({remainingMs:120}));
  assert.equal(emergency.publicationDeadlineFromGoMs,0);assert.deepEqual(emergency.purchasedBlocksMs,[]);
  assert.equal(emergency.reason,'no_affordable_candidate_block');
});
test('elapsed admission time consumes the hard envelope and cannot become a partial block purchase',()=>{
  const decision=module.decideExperimentalPublication(admit(candidate()),input({remainingMs:900,elapsedMs:600}));
  assert.equal(decision.publicationDeadlineFromGoMs,600);assert.deepEqual(decision.purchasedBlocksMs,[]);
});
test('two candidate allocation strategies share inputs while preserving future opportunity cost',()=>{
  const target=candidate(),future=candidate('preserve_future_blocks_v1');target.candidate_blocks_ms=[3000,3000];future.candidate_blocks_ms=[3000,3000];
  const a=module.decideExperimentalPublication(admit(target),input({remainingMs:7000}));
  const b=module.decideExperimentalPublication(admit(future),input({remainingMs:7000}));
  assert.deepEqual(a.purchasedBlocksMs,[3000,3000]);assert.deepEqual(b.purchasedBlocksMs,[3000]);
  assert.equal(b.reason,'future_candidate_capacity_reserved');
});
test('resolved move bypasses candidate experiments and unsupported increment fails closed',()=>{
  const resolved=module.decideExperimentalPublication(admit(candidate()),input({applicability:'resolved_without_search_time'}));
  assert.equal(resolved.publicationDeadlineFromGoMs,0);assert.equal(resolved.reason,'timing_not_applicable');
  assert.throws(()=>module.decideExperimentalPublication(admit(candidate()),input({incrementMs:0})),/unsupported/);
});
test('initial control is independent of remaining clock and unsupported controls fail closed',()=>{
  assert.throws(()=>module.decideExperimentalPublication(admit(candidate()),input({initialTimeMs:300000,remainingMs:180000})),/unsupported/);
});
test('changing accessors cannot bypass clock or focus validation',()=>{
  const changing=input();let reads=0;Object.defineProperty(changing,'remainingMs',{enumerable:true,get:()=>++reads===1?900:Infinity});
  assert.throws(()=>module.decideExperimentalPublication(admit(candidate()),changing),/data|accessor/);
  const focus=input();Object.defineProperty(focus.focusIdentity,'rootEpoch',{enumerable:true,get:()=>Infinity});
  assert.throws(()=>module.decideExperimentalPublication(admit(candidate()),focus),/data|accessor/);
});
test('explicit no-purchase baseline is distinct from a useful elapsed block',()=>{
  const baseline=candidate();baseline.strategy.target_blocks=0;
  const decision=module.decideExperimentalPublication(admit(baseline),input({elapsedMs:40}));
  assert.equal(decision.publicationDeadlineFromGoMs,40);assert.deepEqual(decision.purchasedBlocksMs,[]);assert.equal(decision.usefulBlockAuthority,false);
  assert.equal(decision.reason,'baseline_no_discretionary_purchase');
});
