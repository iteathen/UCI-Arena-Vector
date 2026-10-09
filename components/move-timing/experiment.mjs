import {createHash} from 'node:crypto';

const admitted=new WeakSet();
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const hex=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
function closed(value,keys,label){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!keys.includes(key))||keys.some(key=>!Object.hasOwn(value,key)))throw new Error(`invalid ${label} fields`);}
function integer(value,min,max,label){if(!Number.isSafeInteger(value)||value<min||value>max)throw new Error(`invalid ${label}`);return value;}
function freeze(value){if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
function ownedData(value){
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('timing input requires a data record');
  const descriptors=Object.getOwnPropertyDescriptors(value),result={};
  for(const key of Reflect.ownKeys(descriptors)){const descriptor=descriptors[key];if(typeof key!=='string'||!Object.hasOwn(descriptor,'value'))throw new Error('timing input requires data properties without accessors');Object.defineProperty(result,key,{value:descriptor.value,enumerable:true,writable:true,configurable:true});}
  return result;
}

// Candidate elapsed treatments are deliberately not called useful blocks.
// Admission cannot confer production allocation or qualification authority.
export function admitTimingExperiment(text,{sha256,runtimeIdentitySha256}){
  if(typeof text!=='string'||Buffer.byteLength(text)>16384||!hex(sha256)||hash(text)!==sha256)throw new Error('timing experiment digest mismatch');
  const value=JSON.parse(text);
  closed(value,['schema','diagnostic','campaign_id','runtime_identity_sha256','rules_profile','strategy','candidate_blocks_ms','local_publication_reserve_ms','supported_inputs','qualification'],'experiment');
  if(value.schema!=='vector_timing_experiment_v1'||value.diagnostic!==true||typeof value.campaign_id!=='string'||!/^[a-zA-Z0-9_+.-]{1,128}$/.test(value.campaign_id)||value.rules_profile!=='orthodoxy-live-claims-v1')throw new Error('unsupported diagnostic experiment');
  if(!hex(runtimeIdentitySha256)||value.runtime_identity_sha256!==runtimeIdentitySha256)throw new Error('timing experiment runtime identity mismatch');
  closed(value.qualification,['timing','strength','useful_blocks','publication'],'qualification');
  if(Object.values(value.qualification).some(v=>v!==false))throw new Error('experiment cannot grant qualification');
  const strategy=value.strategy;
  if(strategy?.kind==='target_blocks_v1')closed(strategy,['kind','target_blocks'],'strategy');
  else if(strategy?.kind==='preserve_future_blocks_v1'){closed(strategy,['kind','target_blocks','future_decisions'],'strategy');integer(strategy.future_decisions,1,256,'future decisions');}
  else throw new Error('unsupported experimental strategy');
  if(!Array.isArray(value.candidate_blocks_ms)||value.candidate_blocks_ms.length<1||value.candidate_blocks_ms.length>32)throw new Error('invalid candidate elapsed blocks');
  value.candidate_blocks_ms.forEach(v=>integer(v,1,60000,'candidate block'));
  integer(strategy.target_blocks,1,value.candidate_blocks_ms.length,'target blocks');
  integer(value.local_publication_reserve_ms,0,10000,'local publication reserve');
  closed(value.supported_inputs,['initial_time_ms','increment_ms'],'supported inputs');
  integer(value.supported_inputs.initial_time_ms,1,3600000,'initial time');integer(value.supported_inputs.increment_ms,0,60000,'increment');
  const handle=freeze({...value,sha256});admitted.add(handle);return handle;
}

export function decideExperimentalPublication(handle,input){
  if(!admitted.has(handle))throw new Error('unadmitted timing experiment');
  input=ownedData(input);input.focusIdentity=ownedData(input.focusIdentity);
  closed(input,['initialTimeMs','remainingMs','incrementMs','movesToGo','explicitLimitMs','transportReserveMs','elapsedMs','applicability','focusIdentity'],'timing input');
  integer(input.initialTimeMs,1,3600000,'initial time');
  integer(input.remainingMs,0,0xffff_fffe,'remaining clock');integer(input.incrementMs,0,60000,'increment');integer(input.transportReserveMs,0,60000,'transport reserve');
  if(!Number.isFinite(input.elapsedMs)||input.elapsedMs<0||input.elapsedMs>0xffff_fffe)throw new Error('invalid elapsed time');
  if(input.movesToGo!==null)integer(input.movesToGo,1,0xffff_fffe,'moves to go');
  if(input.explicitLimitMs!==null)integer(input.explicitLimitMs,0,0xffff_fffe,'explicit limit');
  closed(input.focusIdentity,['rootEpoch','requestId'],'focus identity');for(const word of Object.values(input.focusIdentity))integer(word,1,0xffff_fffe,'focus identity');
  if(!['search_derived','constrained_search','advisory_search','resolved_without_search_time'].includes(input.applicability))throw new Error('invalid timing applicability');
  const reserve=handle.local_publication_reserve_ms+input.transportReserveMs;
  const safeEnvelopeFromGoMs=Math.max(0,Math.min(input.remainingMs,input.explicitLimitMs??input.remainingMs)-reserve);
  const result=(deadline,blocks,reason)=>freeze({schema:'vector_timing_experiment_decision_v1',diagnostic:true,experiment_sha256:handle.sha256,focusIdentity:{...input.focusIdentity},applicability:input.applicability,clock:{initialTimeMs:input.initialTimeMs,remainingMs:input.remainingMs,incrementMs:input.incrementMs,movesToGo:input.movesToGo},localPublicationReserveMs:handle.local_publication_reserve_ms,transportReserveMs:input.transportReserveMs,safeEnvelopeFromGoMs,publicationDeadlineFromGoMs:deadline,purchasedBlocksMs:blocks,reason,usefulBlockAuthority:false});
  if(input.applicability==='resolved_without_search_time')return result(0,[],'timing_not_applicable');
  if(input.initialTimeMs!==handle.supported_inputs.initial_time_ms||input.incrementMs!==handle.supported_inputs.increment_ms||input.movesToGo!==null)throw new Error('unsupported experimental clock regime');
  let deadline=input.elapsedMs;const purchased=[];
  for(let index=0;index<handle.strategy.target_blocks;index++){
    const block=handle.candidate_blocks_ms[index];
    if(deadline+block>safeEnvelopeFromGoMs)return result(deadline,purchased,purchased.length?'next_candidate_block_unaffordable':'no_affordable_candidate_block');
    if(handle.strategy.kind==='preserve_future_blocks_v1'){
      // This is a frozen candidate, not a learned opportunity-cost claim.
      // Increment remains distinct; only income less than the next full
      // candidate block/reserve can reduce the proposed future capacity.
      const futureCost=handle.strategy.future_decisions*Math.max(0,block+reserve-input.incrementMs);
      if(deadline+block+futureCost>safeEnvelopeFromGoMs)return result(deadline,purchased,'future_candidate_capacity_reserved');
    }
    purchased.push(block);deadline+=block;
  }
  return result(deadline,purchased,'candidate_target_reached');
}
