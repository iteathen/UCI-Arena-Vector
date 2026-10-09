// Batch analysis only. A directional test requires a preregistered positive
// alternative and exchangeable independent matched opening units. Repeated
// colors/games must first aggregate inside their opening unit, never count as
// independent samples. Outcome differences are exact multiples of 1/8.
export function analyzePairedBenefit(values){
  if(!Array.isArray(values))throw new Error('paired outcomes require an array');
  const length=Object.getOwnPropertyDescriptor(values,'length')?.value;
  if(!Number.isSafeInteger(length)||length<1||length>16)throw new Error('paired population outside 1..16 units');
  const scaled=[];
  for(let index=0;index<length;index++){
    const descriptor=Object.getOwnPropertyDescriptor(values,String(index)),value=descriptor?.value;
    if(!descriptor||!Object.hasOwn(descriptor,'value')||!Number.isFinite(value)||Math.abs(value)>1||!Number.isInteger(value*8))throw new Error('invalid exact paired outcome difference');scaled.push(value*8);
  }
  const observed=scaled.reduce((sum,value)=>sum+value,0),permutations=2**length;let extreme=0;
  if(observed>0)for(let mask=0;mask<permutations;mask++){
    let sum=0;for(let index=0;index<length;index++)sum+=((mask>>index)&1)?scaled[index]:-scaled[index];
    if(sum>=observed)extreme++;
  }
  return Object.freeze({schema:'vector_directional_paired_randomization_v1',units:length,mean_delta:observed/(8*length),directional_p:observed>0?extreme/permutations:1,permutations,outcome_quantum:1/8,qualification_authority:false});
}
