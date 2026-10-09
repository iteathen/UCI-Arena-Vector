import test from 'node:test';
import assert from 'node:assert/strict';
import * as timing from '../../components/move-timing/allocation.mjs';

const clock = extra => ({
  initialTimeMs:0, remainingMs:8100, incrementMs:2000, movesToGo:40,
  explicitLimitMs:1200, transportReserveMs:100, elapsedMs:31.75,
  applicability:'search_derived', focusIdentity:{rootEpoch:7,requestId:9}, ...extra,
});

test('unconfigured remaining-clock authority publishes now with truthful unsupported reserve', () => {
  assert.equal(typeof timing.decideUnqualifiedPublication,'function');
  const decision=timing.decideUnqualifiedPublication(clock());
  assert.deepEqual(decision,{
    schema:'vector_unconfigured_timing_decision_v1', reason:'profile_not_configured',
    focusIdentity:{rootEpoch:7,requestId:9}, applicability:'search_derived',
    clock:{initialTimeMs:0,remainingMs:8100,incrementMs:2000,movesToGo:40,
      explicitLimitMs:1200,elapsedMs:31.75},
    transportReserveMs:100, localPublicationReserveMs:null,
    localPublicationReserveSupport:'unsupported', usefulBlockAuthority:false,
    allocationPolicyAuthority:false, publicationDeadlineFromGoMs:31.75,
    purchasedBlocksMs:[], hardClockEnvelopeFromGoMs:1100, safeEnvelopeFromGoMs:null,
  });
  assert.equal(Object.hasOwn(decision,'policy_sha256'),false);
});

test('clock scarcity, increments and elapsed overruns never create an unqualified wait', () => {
  for(const [extra,wantDeadline,wantHard] of [
    [{remainingMs:0,elapsedMs:9500,incrementMs:60000,explicitLimitMs:null},9500,0],
    [{remainingMs:3600000,elapsedMs:10.125,incrementMs:60000,explicitLimitMs:null,transportReserveMs:50},10.125,3599950],
    [{remainingMs:1,elapsedMs:0.5,incrementMs:0,explicitLimitMs:null,transportReserveMs:0},0.5,1],
  ]) {
    const decision=timing.decideUnqualifiedPublication(clock(extra));
    assert.equal(decision.publicationDeadlineFromGoMs,wantDeadline);
    assert.equal(decision.hardClockEnvelopeFromGoMs,wantHard);
    assert.equal(decision.safeEnvelopeFromGoMs,null);
    assert.deepEqual(decision.purchasedBlocksMs,[]);
    assert.equal(decision.usefulBlockAuthority,false);
  }
});

test('only a current valid remaining clock and focus can enter unsupported searched timing', () => {
  const missing=clock();delete missing.remainingMs;
  assert.throws(()=>timing.decideUnqualifiedPublication(missing),/data/);
  for(const extra of [{remainingMs:undefined},{remainingMs:NaN},{remainingMs:-1},
    {elapsedMs:Infinity},{elapsedMs:-1},{incrementMs:60001},
    {focusIdentity:{rootEpoch:0,requestId:9}},
    {focusIdentity:{rootEpoch:7,requestId:0}},
    {applicability:'resolved_without_search_time'},
    {infinite:true},{ponder:true},{movetime:500}]) {
    assert.throws(()=>timing.decideUnqualifiedPublication(clock(extra)));
  }
  for(const applicability of ['constrained_search','advisory_search']) {
    assert.equal(timing.decideUnqualifiedPublication(clock({applicability})).applicability,applicability);
  }
});

test('clock accessors cannot manufacture authority or execute during validation', () => {
  const value=clock();let reads=0;
  Object.defineProperty(value,'remainingMs',{enumerable:true,get:()=>{reads++;return 1000;}});
  assert.throws(()=>timing.decideUnqualifiedPublication(value),/data|accessor/);
  assert.equal(reads,0);
  const focus=clock();Object.defineProperty(focus.focusIdentity,'rootEpoch',{
    enumerable:true,get:()=>{reads++;return 7;},
  });
  assert.throws(()=>timing.decideUnqualifiedPublication(focus),/data|accessor/);
  assert.equal(reads,0);
});

test('unconfigured decisions retain immutable copied clock and exact focus facts', () => {
  const value=clock(),decision=timing.decideUnqualifiedPublication(value);
  value.remainingMs=0;value.focusIdentity.rootEpoch=8;
  assert.equal(decision.clock.remainingMs,8100);
  assert.deepEqual(decision.focusIdentity,{rootEpoch:7,requestId:9});
  for(const owned of [decision,decision.clock,decision.focusIdentity,decision.purchasedBlocksMs]) {
    assert.ok(Object.isFrozen(owned));
  }
  assert.throws(()=>decision.purchasedBlocksMs.push(500),TypeError);
  assert.throws(()=>{decision.focusIdentity.requestId=10;},TypeError);
});
