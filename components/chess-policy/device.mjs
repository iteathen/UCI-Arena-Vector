import { createHash } from 'node:crypto';
const fn=(name,parameters,returns)=>({name,kind:'device',parameters:parameters.map(([name,type])=>({name,type})),returns});

export function buildChessPolicyDeviceModule(options={}) {
  if(Object.keys(options).some(key=>!['exploration','maximumActions'].includes(key)))throw new Error('Unknown chess policy option');
  const exploration=options.exploration??1.5,maximumActions=options.maximumActions??256;
  if(!Number.isFinite(exploration)||exploration<=0||exploration>16)throw new Error('Policy exploration must be finite in (0,16]');
  if(!Number.isInteger(maximumActions)||maximumActions<1||maximumActions>256)throw new Error('Policy action capacity must be 1..256');
  const profile={id:'vector.chess-puct-proof/0.1.0',maximumActions,exploration,nodeU32Words:6,nodeF32Words:4,edgeU32Words:6,edgeF32Words:4,valueWords:2,nodePerspective:'side-to-move',edgePerspective:'parent-side-to-move',proofRule:'any-win/all-loss/all-proven-draw',maximumVisits:10000000,prior:'stable-legal-masked-softmax',selection:'parent-mean-plus-puct',publication:'proof-then-visits-mean-prior-action',status:'owner-authorized-candidate'};
  const source=`
function vNormalizePriors(logits,lb,indices,ib,priors,pb,count) {
  if(count===gpu.u32(0)||count>gpu.u32(${maximumActions})){return gpu.u32(1);}
  let maximum=gpu.f32(-1000000);
  for(let j=gpu.u32(0);j<count;j++){let index=indices[ib+j];if(index<gpu.i32(0)||index>=gpu.i32(4162)){return gpu.u32(2);}let x=logits[lb+gpu.u32(index)];if(x!==x||x<gpu.f32(-1000000)||x>gpu.f32(1000000)){return gpu.u32(3);}if(x>maximum){maximum=x;}}
  let sum=gpu.f32(0);
  for(let j=gpu.u32(0);j<count;j++){sum=sum+gpu.math.exp(logits[lb+gpu.u32(indices[ib+j])]-maximum);}
  if(sum!==sum||sum<gpu.f32(1)||sum>gpu.f32(${maximumActions})){return gpu.u32(3);}
  for(let j=gpu.u32(0);j<count;j++){priors[pb+j]=gpu.math.exp(logits[lb+gpu.u32(indices[ib+j])]-maximum)/sum;}
  return gpu.u32(0);
}
function vChoose(records,rb,numeric,fb,count,explore) {
  if(count===gpu.u32(0)||count>gpu.u32(${maximumActions})){return gpu.u32(4294967295);}
  let total=gpu.f32(1);let hasSafe=false;
  for(let j=gpu.u32(0);j<count;j++){let b=rb+j*gpu.u32(6);if(records[b]>gpu.u32(10000000)||records[b+gpu.u32(2)]>gpu.u32(3)){return gpu.u32(4294967295);}total=total+gpu.f32(records[b]);if(records[b+gpu.u32(2)]!==gpu.u32(2)){hasSafe=true;}}
  let best=gpu.u32(4294967295);let bestRank=gpu.u32(0);let bestVisits=gpu.u32(0);let bestScore=gpu.f32(-1000000);let bestPrior=gpu.f32(-1);let bestAction=gpu.u32(4294967295);
  for(let j=gpu.u32(0);j<count;j++){
    let b=rb+j*gpu.u32(6);let f=fb+j*gpu.u32(4);let proof=records[b+gpu.u32(2)];if(hasSafe&&proof===gpu.u32(2)){continue;}let visits=records[b];let action=records[b+gpu.u32(4)];let rank=gpu.u32(1);if(proof===gpu.u32(1)){rank=gpu.u32(2);}let mean=gpu.f32(0);if(visits!==gpu.u32(0)){mean=numeric[f]/gpu.f32(visits);}if(proof===gpu.u32(3)){mean=gpu.f32(0);}let prior=numeric[f+gpu.u32(1)];if(mean!==mean||mean<gpu.f32(-1.00001)||mean>gpu.f32(1.00001)||prior!==prior||prior<gpu.f32(0)||prior>gpu.f32(1)){return gpu.u32(4294967295);}let score=mean;if(explore!==gpu.u32(0)){score=score+gpu.f32(${exploration})*prior*gpu.math.sqrt(total)/(gpu.f32(1)+gpu.f32(visits)+gpu.f32(records[b+gpu.u32(1)]!==gpu.u32(0)));}
    let better=false;
    if(best===gpu.u32(4294967295)||rank>bestRank){better=true;}else if(rank===bestRank){if(explore!==gpu.u32(0)){if(score>bestScore||(score===bestScore&&action<bestAction)){better=true;}}else{if(visits>bestVisits||(visits===bestVisits&&(score>bestScore||(score===bestScore&&(prior>bestPrior||(prior===bestPrior&&action<bestAction)))))){better=true;}}}
    if(better){best=j;bestRank=rank;bestVisits=visits;bestScore=score;bestPrior=prior;bestAction=action;}
  }
  return best;
}
function vProve(records,base,count) {
  if(count===gpu.u32(0)||count>gpu.u32(${maximumActions})){return gpu.u32(0);}let allLoss=true;let allKnown=true;let draw=false;let win=false;
  for(let j=gpu.u32(0);j<count;j++){let proof=records[base+j*gpu.u32(6)+gpu.u32(2)];if(proof>gpu.u32(3)){return gpu.u32(0);}if(proof===gpu.u32(1)){win=true;}if(proof!==gpu.u32(2)){allLoss=false;}if(proof===gpu.u32(0)){allKnown=false;}if(proof===gpu.u32(3)){draw=true;}}
  if(win){return gpu.u32(1);}if(allLoss){return gpu.u32(2);}if(allKnown&&draw){return gpu.u32(3);}return gpu.u32(0);
}
function vBackup(records,nb,eb,numeric,nfb,efb,value,proof) {
  if(value!==value||value<gpu.f32(-1)||value>gpu.f32(1)||proof>gpu.u32(3)||records[nb]>=gpu.u32(10000000)){return gpu.u32(1);}if(eb!==gpu.u32(4294967295)&&records[eb]>=gpu.u32(10000000)){return gpu.u32(1);}
  records[nb]=records[nb]+gpu.u32(1);numeric[nfb]=numeric[nfb]+value;if(proof!==gpu.u32(0)){records[nb+gpu.u32(2)]=proof;}
  if(eb!==gpu.u32(4294967295)){records[eb]=records[eb]+gpu.u32(1);numeric[efb]=numeric[efb]-value;let parentProof=proof;if(proof===gpu.u32(1)){parentProof=gpu.u32(2);}else if(proof===gpu.u32(2)){parentProof=gpu.u32(1);}if(parentProof!==gpu.u32(0)){records[eb+gpu.u32(2)]=parentProof;}}
  return gpu.u32(0);
}
`;
  const functions=[
    fn('vNormalizePriors',[['logits','ptr<f32>'],['lb','u32'],['indices','ptr<i32>'],['ib','u32'],['priors','ptr<f32>'],['pb','u32'],['count','u32']],'u32'),
    fn('vChoose',[['records','ptr<u32>'],['rb','u32'],['numeric','ptr<f32>'],['fb','u32'],['count','u32'],['explore','u32']],'u32'),
    fn('vProve',[['records','ptr<u32>'],['base','u32'],['count','u32']],'u32'),
    fn('vBackup',[['records','ptr<u32>'],['nb','u32'],['eb','u32'],['numeric','ptr<f32>'],['nfb','u32'],['efb','u32'],['value','f32'],['proof','u32']],'u32'),
  ];
  return {source,functions,profile,sourceIdentity:{algorithm:'sha256',sha256:createHash('sha256').update(source.replace(/\r\n?/g,'\n').replace(/\n+$/g,'')+'\n').digest('hex')}};
}
