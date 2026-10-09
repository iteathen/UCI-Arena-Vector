import {createHash} from 'node:crypto';
import {consumeClockInput,chooseElapsedBlocks} from './allocation.mjs';
const admitted=new WeakSet(),hex=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
function closed(value,keys){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!keys.includes(key))||keys.some(key=>!Object.hasOwn(value,key)))throw new Error('invalid timing policy fields');}
function integer(value,min,max){if(!Number.isSafeInteger(value)||value<min||value>max)throw new Error('invalid timing policy integer');}
function freeze(value){if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
export function admitTimingPolicy(text,{sha256,runtimeIdentitySha256}){
  if(typeof text!=='string'||Buffer.byteLength(text)>16384||!hex(sha256)||createHash('sha256').update(text).digest('hex')!==sha256)throw new Error('timing policy artifact digest mismatch');
  const value=JSON.parse(text);closed(value,['schema','producer','runtime_identity_sha256','control','strategy','useful_blocks_ms','local_publication_reserve_ms','unsupported_fallback','qualification']);
  if(value.schema!=='vector_timing_policy_v1'||value.producer!=='vector-evidence-runtime/clock-allocation-v1'||value.unsupported_fallback!=='publish-current')throw new Error('unsupported timing policy producer');
  if(!hex(runtimeIdentitySha256)||value.runtime_identity_sha256!==runtimeIdentitySha256)throw new Error('timing policy runtime identity mismatch');
  closed(value.control,['initial_time_ms','increment_ms']);integer(value.control.initial_time_ms,1,3600000);integer(value.control.increment_ms,0,60000);integer(value.local_publication_reserve_ms,1,10000);
  const strategy=value.strategy;if(strategy?.kind==='target_blocks_v1')closed(strategy,['kind','target_blocks']);else if(strategy?.kind==='preserve_future_blocks_v1'){closed(strategy,['kind','target_blocks','future_decisions']);integer(strategy.future_decisions,1,256);}else throw new Error('unsupported qualified strategy');
  if(!Array.isArray(value.useful_blocks_ms)||value.useful_blocks_ms.length<1||value.useful_blocks_ms.length>32)throw new Error('qualified useful blocks unavailable');value.useful_blocks_ms.forEach(block=>integer(block,1,60000));integer(strategy.target_blocks,1,value.useful_blocks_ms.length);
  const q=value.qualification;closed(q,['status','study_sha256','discovery_sha256','held_out_sha256','reserve_sha256','allocation','useful_blocks','clock_safety','discovery','held_out']);
  if(q.status!=='qualified'||q.allocation!==true||q.useful_blocks!==true||q.clock_safety!==true||['study_sha256','discovery_sha256','held_out_sha256','reserve_sha256'].some(key=>!hex(q[key])))throw new Error('producer qualification authority unavailable');
  for(const result of [q.discovery,q.held_out]){closed(result,['opening_units','mean_score_gain','directional_p']);integer(result.opening_units,8,16);if(!Number.isFinite(result.mean_score_gain)||result.mean_score_gain<.05||result.mean_score_gain>1||!Number.isFinite(result.directional_p)||result.directional_p<0||result.directional_p>.05)throw new Error('producer population benefit gate failed');}
  const handle=freeze({...value,sha256,diagnostic:false});admitted.add(handle);return handle;
}
export function decidePolicyPublication(handle,value){
  if(!admitted.has(handle))throw new Error('unadmitted qualified timing policy');const input=consumeClockInput(value,{allowUnknownInitial:true});
  const reserve=handle.local_publication_reserve_ms+input.transportReserveMs,safe=Math.max(0,Math.min(input.remainingMs,input.explicitLimitMs??input.remainingMs)-reserve);
  let result,usefulBlockAuthority=true;
  if(input.applicability==='resolved_without_search_time'){result={publicationDeadlineFromGoMs:0,purchasedBlocksMs:[],safeEnvelopeFromGoMs:safe,reason:'timing_not_applicable'};usefulBlockAuthority=false;}
  else if(input.initialTimeMs!==handle.control.initial_time_ms||input.incrementMs!==handle.control.increment_ms||input.movesToGo!==null){result={publicationDeadlineFromGoMs:0,purchasedBlocksMs:[],safeEnvelopeFromGoMs:safe,reason:'unsupported_control_publish_current'};usefulBlockAuthority=false;}
  else{result=chooseElapsedBlocks({strategy:handle.strategy,blocks:handle.useful_blocks_ms,localReserve:handle.local_publication_reserve_ms},input);result.reason=({next_block_unaffordable:'next_useful_block_unaffordable',no_affordable_block:'no_affordable_useful_block',future_capacity_reserved:'future_useful_capacity_reserved',target_reached:'qualified_target_reached'})[result.reason];}
  return freeze({schema:'vector_timing_policy_decision_v1',diagnostic:false,policy_sha256:handle.sha256,focusIdentity:{...input.focusIdentity},applicability:input.applicability,clock:{initialTimeMs:input.initialTimeMs,remainingMs:input.remainingMs,incrementMs:input.incrementMs,movesToGo:input.movesToGo},localPublicationReserveMs:handle.local_publication_reserve_ms,transportReserveMs:input.transportReserveMs,usefulBlockAuthority,...result});
}
