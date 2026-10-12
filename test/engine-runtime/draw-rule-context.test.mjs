import assert from 'node:assert/strict';
import test from 'node:test';
import {buildEngineDomainModule} from '../../components/engine-runtime/domain-device.mjs';
import {buildEngineSessionDomainModule} from '../../components/engine-runtime/domain-transition.mjs';
import {buildChessPolicyHooks,CLAIM_SCRATCH_WORDS} from '../../components/engine-runtime/policy-hooks.mjs';
const layout={requestInputPartition:{dtype:'f32',perRequestElements:1088,elementCount:1088,members:[{parameterName:'input0',offset:0,perItemElements:1088}]},resultOutputPartition:{dtype:'f32',perRequestElements:4163,elementCount:4163,members:[{parameterName:'output0',offset:0,perItemElements:4162},{parameterName:'output1',offset:4162,perItemElements:1}]},featureParameter:'input0',policyParameter:'output0',valueParameter:'output1'};
test('automatic threefold is explicit and owns a different Domain source and profile identity',()=>{
 const ordinary=buildEngineDomainModule(),automatic=buildEngineDomainModule({automaticThreefold:true});
 assert.equal(ordinary.drawProfile,'orthodox_live_claims_v1');assert.equal(automatic.drawProfile,'lichess_bot_automatic_threefold_v1');assert.notEqual(automatic.sourceIdentity.sha256,ordinary.sourceIdentity.sha256);
 assert.notEqual(buildEngineSessionDomainModule({automaticThreefold:true}).profileVersion,buildEngineSessionDomainModule().profileVersion);assert.equal(automatic.stateWords,ordinary.stateWords);
 assert.throws(()=>buildEngineDomainModule({automaticThreefold:'true'}),/boolean/);
});
test('current node and intended action rights have distinct typed owner records and exact scratch capability',()=>{
 const generic=buildChessPolicyHooks({evaluatorLayout:layout}),automatic=buildChessPolicyHooks({evaluatorLayout:layout,automaticThreefold:true});
 assert.equal(generic.drawClaims.nodeMaskWord,4);assert.equal(generic.drawClaims.edgeMaskWord,5);assert.equal(generic.drawClaims.scratchWords,CLAIM_SCRATCH_WORDS);assert.equal(CLAIM_SCRATCH_WORDS,71+17223+256);
 assert.notEqual(automatic.sourceIdentity.sha256,generic.sourceIdentity.sha256);assert.equal(automatic.drawClaims.automaticThreefold,true);assert.equal(generic.functions.find(f=>f.name===generic.hooks.consumeEvaluation).parameters.at(-1).name,'claimScratch');
 assert(generic.functions.find(f=>f.name==='vClaimMasks').calls.includes('cApply'));assert.throws(()=>buildChessPolicyHooks({evaluatorLayout:layout,automaticThreefold:1}),/boolean/);
});
