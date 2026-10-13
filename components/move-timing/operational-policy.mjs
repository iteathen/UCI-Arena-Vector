import {createHash} from 'node:crypto';
import {consumeClockInput} from './allocation.mjs';

const admitted=new WeakSet(),hex=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
function closed(value,keys){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||keys.some(key=>!Object.hasOwn(value,key)))throw new Error('invalid operational timing fields');}
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}

// Successor authority is native clock execution only, not the historical
// population-qualified marginal-block or playing-strength claim.
export function admitOperationalTimingPolicy(text,{sha256,runtimeIdentitySha256}){
  if(typeof text!=='string'||Buffer.byteLength(text)>16384||!hex(sha256)||createHash('sha256').update(text).digest('hex')!==sha256)throw new Error('operational timing digest mismatch');
  const value=JSON.parse(text);
  closed(value,['schema','producer','runtime_identity_sha256','control','strategy','local_publication_reserve_ms','unsupported_fallback','qualification']);
  if(value.schema!=='vector_operational_timing_policy_v1'||value.producer!=='vector-evidence-runtime/operational-clock-budget-v1'||value.unsupported_fallback!=='publish-current')throw new Error('unsupported operational timing producer');
  if(!hex(runtimeIdentitySha256)||value.runtime_identity_sha256!==runtimeIdentitySha256)throw new Error('operational timing runtime identity mismatch');
  closed(value.control,['initial_time_ms','increment_ms']);
  if(value.control.initial_time_ms!==180000||value.control.increment_ms!==0)throw new Error('unsupported operational timing control');
  closed(value.strategy,['kind','future_decisions']);
  if(value.strategy.kind!=='remaining_clock_share_v1'||!Number.isSafeInteger(value.strategy.future_decisions)||value.strategy.future_decisions<2||value.strategy.future_decisions>256)throw new Error('invalid operational decision horizon');
  if(!Number.isSafeInteger(value.local_publication_reserve_ms)||value.local_publication_reserve_ms<1||value.local_publication_reserve_ms>10000)throw new Error('invalid operational publication reserve');
  const q=value.qualification;
  closed(q,['status','scope','evidence_class','receipt_sha256','reserve_sha256','allocation_execution','clock_safety','useful_blocks','strength','optimality']);
  if(q.status!=='qualified-for-declared-execution'||q.scope!=='native_clock_execution'||q.evidence_class!=='native'||!hex(q.receipt_sha256)||!hex(q.reserve_sha256)||q.allocation_execution!==true||q.clock_safety!==true||q.useful_blocks!==false||q.strength!==false||q.optimality!==false)throw new Error('native operational qualification unavailable');
  const handle=freeze({...value,sha256,diagnostic:false});admitted.add(handle);return handle;
}

export const isOperationalTimingPolicy=handle=>admitted.has(handle);

export function decideOperationalPublication(handle,value){
  if(!admitted.has(handle))throw new Error('unadmitted operational timing policy');
  return decideOperationalClock(handle,value,{policy_sha256:handle.sha256,qualificationScope:'native_clock_execution',diagnostic:false});
}

// Pure arithmetic shared by production and the separately admitted diagnostic
// experiment. Calling it alone confers no admitted policy or qualification.
export function decideOperationalClock(handle,value,authority){
  const input=consumeClockInput(value,{allowUnknownInitial:true});
  const reserve=handle.local_publication_reserve_ms+input.transportReserveMs;
  const safeClock=Math.max(0,input.remainingMs-reserve);
  const safeEnvelopeFromGoMs=Math.max(0,Math.min(input.remainingMs,input.explicitLimitMs??input.remainingMs)-reserve);
  let deadline=0,reason='timing_not_applicable',operationalBudgetAuthority=false;
  if(input.applicability!=='resolved_without_search_time'){
    if(input.initialTimeMs!==handle.control.initial_time_ms||input.incrementMs!==handle.control.increment_ms||input.movesToGo!==null||input.remainingMs>handle.control.initial_time_ms){reason='unsupported_control_publish_current';}
    else{
      operationalBudgetAuthority=true;
      const budget=Math.min(safeEnvelopeFromGoMs,Math.floor(safeClock/handle.strategy.future_decisions));
      // Deadline is from go receipt; admission is never added to the budget.
      // If already elapsed, immediate publication cannot recover lost clock.
      deadline=Math.max(input.elapsedMs,budget);
      reason=budget===0?'operational_clock_reserve_exhausted':input.elapsedMs>=budget?'operational_budget_already_elapsed':'operational_clock_share';
    }
  }
  return freeze({schema:authority.diagnostic?'vector_timing_experiment_decision_v1':'vector_timing_policy_decision_v1',...authority,focusIdentity:{...input.focusIdentity},applicability:input.applicability,clock:{initialTimeMs:input.initialTimeMs,remainingMs:input.remainingMs,incrementMs:input.incrementMs,movesToGo:input.movesToGo},localPublicationReserveMs:handle.local_publication_reserve_ms,transportReserveMs:input.transportReserveMs,usefulBlockAuthority:false,operationalBudgetAuthority:!authority.diagnostic&&operationalBudgetAuthority,safeEnvelopeFromGoMs,publicationDeadlineFromGoMs:deadline,purchasedBlocksMs:[],reason});
}
