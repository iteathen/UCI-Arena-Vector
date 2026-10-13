import {createHash} from 'node:crypto';
import {decideOperationalClock} from './operational-policy.mjs';
const admitted=new WeakSet();
const hex=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
function closed(value,keys){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||keys.some(key=>!Object.hasOwn(value,key)))throw new Error('invalid operational experiment fields');}
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
export function admitOperationalExperiment(text,{sha256,runtimeIdentitySha256}){
  if(typeof text!=='string'||Buffer.byteLength(text)>16384||!hex(sha256)||createHash('sha256').update(text).digest('hex')!==sha256)throw new Error('operational experiment digest mismatch');
  const v=JSON.parse(text);closed(v,['schema','diagnostic','campaign_id','runtime_identity_sha256','rules_profile','strategy','local_publication_reserve_ms','supported_inputs','qualification']);
  if(v.schema!=='vector_operational_timing_experiment_v1'||v.diagnostic!==true||typeof v.campaign_id!=='string'||!/^[A-Za-z0-9_+.-]{1,128}$/.test(v.campaign_id)||!['orthodoxy-live-claims-v1','lichess-bot-automatic-threefold-v1'].includes(v.rules_profile))throw new Error('unsupported operational experiment');
  if(!hex(runtimeIdentitySha256)||v.runtime_identity_sha256!==runtimeIdentitySha256)throw new Error('operational experiment runtime identity mismatch');
  closed(v.supported_inputs,['initial_time_ms','increment_ms']);if(v.supported_inputs.initial_time_ms!==180000||v.supported_inputs.increment_ms!==0)throw new Error('unsupported operational experiment control');
  closed(v.strategy,['kind','future_decisions']);if(v.strategy.kind!=='remaining_clock_share_v1'||!Number.isSafeInteger(v.strategy.future_decisions)||v.strategy.future_decisions<2||v.strategy.future_decisions>256)throw new Error('invalid operational experiment horizon');
  if(!Number.isSafeInteger(v.local_publication_reserve_ms)||v.local_publication_reserve_ms<1||v.local_publication_reserve_ms>10000)throw new Error('invalid operational experiment reserve');
  closed(v.qualification,['timing','strength','useful_blocks','publication']);if(Object.values(v.qualification).some(value=>value!==false))throw new Error('operational experiment cannot grant qualification');
  const handle=freeze({...v,sha256,control:v.supported_inputs});admitted.add(handle);return handle;
}
export const isOperationalExperiment=handle=>admitted.has(handle);
export function decideOperationalExperiment(handle,input){
  if(!admitted.has(handle))throw new Error('unadmitted operational experiment');
  return decideOperationalClock(handle,input,{experiment_sha256:handle.sha256,qualificationScope:'diagnostic_clock_execution',diagnostic:true});
}
