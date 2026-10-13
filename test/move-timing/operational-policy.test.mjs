import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {admitTimingPolicy,decidePolicyPublication} from '../../components/move-timing/policy.mjs';
import {admitTimingExperiment,decideExperimentalPublication} from '../../components/move-timing/experiment.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex'),identity=sha('exact runtime');
// Declaration fixtures test admission and arithmetic only. They are never
// packaged or treated as native execution evidence.
const policy=()=>({schema:'vector_operational_timing_policy_v1',producer:'vector-evidence-runtime/operational-clock-budget-v1',runtime_identity_sha256:identity,control:{initial_time_ms:180000,increment_ms:0},strategy:{kind:'remaining_clock_share_v1',future_decisions:32},local_publication_reserve_ms:100,unsupported_fallback:'publish-current',qualification:{status:'qualified-for-declared-execution',scope:'native_clock_execution',evidence_class:'native',receipt_sha256:sha('execution'),reserve_sha256:sha('reserve'),allocation_execution:true,clock_safety:true,useful_blocks:false,strength:false,optimality:false}});
const admit=value=>{const text=JSON.stringify(value);return admitTimingPolicy(text,{sha256:sha(text),runtimeIdentitySha256:identity});};
const input=extra=>({initialTimeMs:180000,remainingMs:180000,incrementMs:0,movesToGo:null,explicitLimitMs:null,transportReserveMs:1450,elapsedMs:0,applicability:'search_derived',focusIdentity:{rootEpoch:1,requestId:1},...extra});

test('native execution experiments remain diagnostic and cannot grant useful-block or managed policy authority',()=>{
 const v=policy(),experiment={schema:'vector_operational_timing_experiment_v1',diagnostic:true,campaign_id:'operational-fixture',runtime_identity_sha256:identity,rules_profile:'lichess-bot-automatic-threefold-v1',strategy:v.strategy,local_publication_reserve_ms:v.local_publication_reserve_ms,supported_inputs:v.control,qualification:{timing:false,strength:false,useful_blocks:false,publication:false}};
 const text=JSON.stringify(experiment),handle=admitTimingExperiment(text,{sha256:sha(text),runtimeIdentitySha256:identity}),decision=decideExperimentalPublication(handle,input());
 assert.equal(decision.publicationDeadlineFromGoMs,5576);assert.equal(decision.diagnostic,true);assert.equal(decision.operationalBudgetAuthority,false);assert.equal(decision.usefulBlockAuthority,false);assert.throws(()=>admitTimingPolicy(text,{sha256:sha(text),runtimeIdentitySha256:identity}));
 experiment.qualification.timing=true;const changed=JSON.stringify(experiment);assert.throws(()=>admitTimingExperiment(changed,{sha256:sha(changed),runtimeIdentitySha256:identity}));
});

test('operational budget scales with remaining clock instead of stopping at one 500ms block',()=>{
  const handle=admit(policy()),high=decidePolicyPublication(handle,input()),low=decidePolicyPublication(handle,input({remainingMs:30000}));
  assert.equal(high.publicationDeadlineFromGoMs,5576);assert.equal(low.publicationDeadlineFromGoMs,889);
  assert.equal(high.reason,'operational_clock_share');assert.equal(high.usefulBlockAuthority,false);
  assert.deepEqual(high.purchasedBlocksMs,[]);assert.equal(high.qualificationScope,'native_clock_execution');
});

test('admission is charged once and expired budgets publish immediately',()=>{
  const handle=admit(policy());
  assert.equal(decidePolicyPublication(handle,input({elapsedMs:400})).publicationDeadlineFromGoMs,5576);
  const expired=decidePolicyPublication(handle,input({elapsedMs:6000}));
  assert.equal(expired.publicationDeadlineFromGoMs,6000);assert.equal(expired.reason,'operational_budget_already_elapsed');
});

test('hard clock, explicit limit, and separate transport/local reserves constrain every budget',()=>{
  const handle=admit(policy());
  assert.equal(decidePolicyPublication(handle,input({remainingMs:1600})).publicationDeadlineFromGoMs,1);
  assert.equal(decidePolicyPublication(handle,input({remainingMs:1500})).publicationDeadlineFromGoMs,0);
  const explicit=decidePolicyPublication(handle,input({explicitLimitMs:2000}));assert.equal(explicit.publicationDeadlineFromGoMs,450);
  for(let remainingMs=0;remainingMs<=180000;remainingMs+=113){const decision=decidePolicyPublication(handle,input({remainingMs}));assert(decision.publicationDeadlineFromGoMs<=Math.max(0,remainingMs-1550));}
});

test('unsupported control and resolved knowledge never acquire operational allocation authority',()=>{
  const handle=admit(policy());
  for(const extra of [{initialTimeMs:0},{initialTimeMs:60000},{incrementMs:3000},{movesToGo:20},{remainingMs:0xffff_fffe}]){
    const decision=decidePolicyPublication(handle,input(extra));assert.equal(decision.publicationDeadlineFromGoMs,0);assert.equal(decision.operationalBudgetAuthority,false);
  }
  const resolved=decidePolicyPublication(handle,input({applicability:'resolved_without_search_time'}));assert.equal(resolved.reason,'timing_not_applicable');assert.equal(resolved.publicationDeadlineFromGoMs,0);
});

test('successor requires exact native execution declaration without invented strength/useful-block authority',()=>{
  const handle=admit(policy());assert(Object.isFrozen(handle));assert(Object.isFrozen(handle.qualification));
  for(const change of [v=>v.qualification.evidence_class='fixture',v=>v.qualification.strength=true,v=>v.qualification.useful_blocks=true,v=>v.qualification.optimality=true,v=>v.qualification.clock_safety=false,v=>delete v.qualification.receipt_sha256,v=>v.strategy.future_decisions=0,v=>v.extra=true]){const value=policy();change(value);assert.throws(()=>admit(value));}
  const text=JSON.stringify(policy());assert.throws(()=>admitTimingPolicy(text,{sha256:sha('other'),runtimeIdentitySha256:identity}));assert.throws(()=>admitTimingPolicy(text,{sha256:sha(text),runtimeIdentitySha256:sha('other runtime')}));
});
