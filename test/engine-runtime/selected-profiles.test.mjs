import assert from 'node:assert/strict';
import test from 'node:test';
test('real model selection describes dense logits without proposing Domain actions',async()=>{
  const {chessEvaluatorMeaning,chessPolicyStorageBytes}=await import('../../components/engine-runtime/selected-profiles.mjs');
  const selected=chessEvaluatorMeaning();
  assert.equal(selected.mode,'evaluation-only');
  assert.deepEqual(selected.heads.map(h=>[h.kind,h.elements]),[['custom',4162],['value',1]]);
  assert.equal(selected.actionAuthority,'domain');
  assert.deepEqual(selected.requiredPublication,['policy','value']);
  assert.equal(chessPolicyStorageBytes({nodeCapacity:128,edgeCapacity:8192,maxActions:256,actionWords:1}),357428);
  assert.throws(()=>chessPolicyStorageBytes({nodeCapacity:0,edgeCapacity:8192,maxActions:256,actionWords:1}));
  assert.throws(()=>chessPolicyStorageBytes({nodeCapacity:128,edgeCapacity:8192,maxActions:257,actionWords:1}));
});
