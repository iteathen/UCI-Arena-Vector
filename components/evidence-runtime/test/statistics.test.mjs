import test from 'node:test';
import assert from 'node:assert/strict';
const statistics=await import('../paired-statistics.mjs').catch(()=>({}));
test('preregistered directional paired randomization counts the exact positive tail',()=>{
  assert.equal(typeof statistics.analyzePairedBenefit,'function');
  const result=statistics.analyzePairedBenefit(Array(8).fill(.5));
  assert.equal(result.mean_delta,.5);assert.equal(result.directional_p,1/256);assert.equal(result.permutations,256);assert.equal(result.qualification_authority,false);
});
test('ties and a zero mean supply no positive-benefit evidence',()=>{
  assert.equal(statistics.analyzePairedBenefit(Array(8).fill(0)).directional_p,1);
  assert.equal(statistics.analyzePairedBenefit([.5,.5,.5,.5,-.5,-.5,-.5,-.5]).directional_p,1);
  assert.equal(statistics.analyzePairedBenefit([.5,.5,.5,.5,0,0,0,0]).directional_p,1/16);
});
test('statistics reject unsupported population extent and outcome precision',()=>{
  assert.equal(typeof statistics.analyzePairedBenefit,'function');
  for(const values of [[],Array(17).fill(.5),[NaN],[Infinity],[2],[.1]])assert.throws(()=>statistics.analyzePairedBenefit(values));
});
