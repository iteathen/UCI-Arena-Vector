import { createHash } from 'node:crypto';
export function buildPolicyPublicationModule(){
  const profile={id:'vector.chess-readonly-publication/0.1.0',rowWords:6,headerWords:8,maximumActions:256,byteLength:6176,quantization:1000000,maximumReadAttempts:3,snapshotLifetimeOwner:'cuda-mcgs',comparison:'proof-visits-quantized-parent-mean-prior-packed-action',status:'owner-authorized-candidate'};
  const source=`
function vEncodeSnapshotRow(records,rb,numeric,fb,encoded,base) {
  let visits=records[rb];let proof=records[rb+gpu.u32(2)];let mean=gpu.f32(0);if(visits!==gpu.u32(0)){mean=numeric[fb]/gpu.f32(visits);}let prior=numeric[fb+gpu.u32(1)];
  if(visits>gpu.u32(10000000)||proof>gpu.u32(3)||mean!==mean||mean<gpu.f32(-1.00001)||mean>gpu.f32(1.00001)||prior!==prior||prior<gpu.f32(0)||prior>gpu.f32(1)){return gpu.u32(1);}
  if(proof===gpu.u32(3)){mean=gpu.f32(0);}if(mean<gpu.f32(-1)){mean=gpu.f32(-1);}if(mean>gpu.f32(1)){mean=gpu.f32(1);}
  encoded[base]=visits;encoded[base+gpu.u32(1)]=proof;encoded[base+gpu.u32(2)]=gpu.u32((mean+gpu.f32(1))*gpu.f32(1000000)+gpu.f32(0.5));encoded[base+gpu.u32(3)]=gpu.u32(prior*gpu.f32(1000000)+gpu.f32(0.5));encoded[base+gpu.u32(4)]=gpu.u32(0);return gpu.u32(0);
}
function vChooseEncoded(rows,base,count) {
  if(count===gpu.u32(0)||count>gpu.u32(256)){return gpu.u32(4294967295);}
  let best=gpu.u32(4294967295);let rank=gpu.u32(0);let visits=gpu.u32(0);let mean=gpu.u32(0);let prior=gpu.u32(0);let action=gpu.u32(4294967295);
  for(let j=gpu.u32(0);j<count;j++){let row=base+j*gpu.u32(6);let a=rows[row];let n=rows[row+gpu.u32(1)];let proof=rows[row+gpu.u32(2)];let q=rows[row+gpu.u32(3)];let p=rows[row+gpu.u32(4)];if(a>=gpu.u32(32768)||n>gpu.u32(10000000)||proof>gpu.u32(3)||q>gpu.u32(2000000)||p>gpu.u32(1000000)||rows[row+gpu.u32(5)]!==gpu.u32(0)){return gpu.u32(4294967295);}let r=gpu.u32(1);if(proof===gpu.u32(1)){r=gpu.u32(2);}else if(proof===gpu.u32(2)){r=gpu.u32(0);}if(best===gpu.u32(4294967295)||r>rank||(r===rank&&(n>visits||(n===visits&&(q>mean||(q===mean&&(p>prior||(p===prior&&a<action)))))))){best=j;rank=r;visits=n;mean=q;prior=p;action=a;}}
  return best;
}
`;
  const fn=(name,params,returns)=>({name,kind:'device',parameters:params.map(([name,type])=>({name,type})),returns});
  return{source,profile,sourceIdentity:{algorithm:'sha256',sha256:createHash('sha256').update(source.replace(/\r\n?/g,'\n').replace(/\n+$/g,'')+'\n').digest('hex')},functions:[fn('vEncodeSnapshotRow',[['records','ptr<u32>'],['rb','u32'],['numeric','ptr<f32>'],['fb','u32'],['encoded','ptr<u32>'],['base','u32']],'u32'),fn('vChooseEncoded',[['rows','ptr<u32>'],['base','u32'],['count','u32']],'u32')]};
}
