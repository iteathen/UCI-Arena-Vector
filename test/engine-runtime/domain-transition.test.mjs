import assert from 'node:assert/strict';
import test from 'node:test';
import {admitPosition} from '../../components/chess-domain/admission.mjs';
test('selected Session Domain bridge declares transition dispositions separately from frozen state mathematics',async()=>{
  const {buildEngineSessionDomainModule}=await import('../../components/engine-runtime/domain-transition.mjs');
  const d=buildEngineSessionDomainModule();assert.equal(d.hooks.classifyTransitionResult,'vDomainClassifyTransitionResult');
  const f=d.functions.find(f=>f.name===d.hooks.classifyTransitionResult);assert.equal(f.parameters.length,1);assert.equal(f.parameters[0].type,'u32');assert.equal(f.returns,'u32');
  assert.equal(d.stateWords,17223);assert.equal(d.actionWords,1);assert.equal(d.outcomeWords,3);
});
test('cold Session root admission owns GPU effective EP canonicalization while raw model EP survives',async()=>{
  const {buildEngineSessionDomainModule}=await import('../../components/engine-runtime/domain-transition.mjs');const d=buildEngineSessionDomainModule();assert.equal(d.hooks.validateRoot,'vDomainAdmitRoot');assert.equal(d.profileVersion,'1.2.2');const f=d.functions.find(f=>f.name===d.hooks.validateRoot);assert.equal(f.parameters.length,3);assert.equal(f.returns,'bool');
});
test('physical transition disposition maps history pressure and rejects unknown statuses',{skip:process.env.VECTOR_DOMAIN_TRANSITION_NATIVE!=='1'},async()=>{
  const {qualifyTransitionDispositions}=await import('../../components/engine-runtime/domain-transition.mjs');const r=await qualifyTransitionDispositions();
  assert.deepEqual(r.statuses,[0,1,3,4,2,4294967295]);assert.deepEqual(r.dispositions,[0,1,2,3,3,3]);assert.equal(r.guardsPassed,true);assert.equal(r.terminal.graceful,true);assert.equal(r.terminal.driver.resourceCounts.live,0);assert.equal(r.terminal.driver.resourceCounts.orphaned,0);
});
test('physical cold root canonicalizes uncapturable and pinned EP without changing qualified feature planes',{skip:process.env.VECTOR_DOMAIN_ROOT_NATIVE!=='1'},async()=>{
  const states=['rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1','4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2','4r1k1/8/8/3pP3/8/8/8/4K3 w - d6 0 2'].map(fen=>admitPosition(fen).words);
  const {qualifyRootCanonicalization}=await import('../../components/engine-runtime/domain-root-qualification.mjs');const r=await qualifyRootCanonicalization(states);
  assert.deepEqual(r.rows.map(row=>row.effectiveEp),[64,43,64]);assert.deepEqual(r.rows.map(row=>row.rawEp),[20,43,43]);
  for(const row of r.rows){assert.equal(row.valid,true);assert.equal(row.historyEp,row.effectiveEp);assert.equal(row.featureStatusBefore,0);assert.equal(row.featureStatusAfter,0);assert.equal(row.featuresUnchanged,true);assert.equal(row.rawEpPlaneOne,true);assert.equal(row.guardsPassed,true);}
  assert.equal(r.terminal.graceful,true);assert.equal(r.terminal.driver.resourceCounts.live,0);assert.equal(r.terminal.driver.resourceCounts.orphaned,0);
});
