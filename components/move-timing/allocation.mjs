const keys=['initialTimeMs','remainingMs','incrementMs','movesToGo','explicitLimitMs','transportReserveMs','elapsedMs','applicability','focusIdentity'];
function data(value,expected){
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('timing input requires a data record');const descriptors=Object.getOwnPropertyDescriptors(value),result={};
  if(Reflect.ownKeys(descriptors).some(key=>typeof key!=='string'||!expected.includes(key)||!Object.hasOwn(descriptors[key],'value'))||expected.some(key=>!Object.hasOwn(descriptors,key)))throw new Error('timing input requires closed data properties without accessors');
  for(const key of expected)result[key]=descriptors[key].value;return result;
}
function integer(value,min,max,label){if(!Number.isSafeInteger(value)||value<min||value>max)throw new Error(`invalid ${label}`);}
export function consumeClockInput(value,{allowUnknownInitial=false}={}){
  const input=data(value,keys);input.focusIdentity=data(input.focusIdentity,['rootEpoch','requestId']);
  integer(input.initialTimeMs,allowUnknownInitial?0:1,3600000,'initial time');integer(input.remainingMs,0,0xffff_fffe,'remaining clock');integer(input.incrementMs,0,60000,'increment');integer(input.transportReserveMs,0,60000,'transport reserve');
  if(!Number.isFinite(input.elapsedMs)||input.elapsedMs<0||input.elapsedMs>0xffff_fffe)throw new Error('invalid elapsed time');
  if(input.movesToGo!==null)integer(input.movesToGo,1,0xffff_fffe,'moves to go');if(input.explicitLimitMs!==null)integer(input.explicitLimitMs,0,0xffff_fffe,'explicit limit');
  for(const word of Object.values(input.focusIdentity))integer(word,1,0xffff_fffe,'focus identity');
  if(!['search_derived','constrained_search','advisory_search','resolved_without_search_time'].includes(input.applicability))throw new Error('invalid timing applicability');
  return Object.freeze({...input,focusIdentity:Object.freeze(input.focusIdentity)});
}

// Unconfigured remaining-clock mode has no supported discretionary purchase.
// Unknown local publication reserve cannot establish a safe allocation envelope.
export function decideUnqualifiedPublication(value){
  const input=consumeClockInput(value,{allowUnknownInitial:true});
  if(input.applicability==='resolved_without_search_time'){
    throw new Error('unconfigured searched timing requires unresolved applicability');
  }
  const hardClockEnvelopeFromGoMs=Math.max(0,
    Math.min(input.remainingMs,input.explicitLimitMs??input.remainingMs)-input.transportReserveMs);
  return Object.freeze({
    schema:'vector_unconfigured_timing_decision_v1',reason:'profile_not_configured',
    focusIdentity:input.focusIdentity,applicability:input.applicability,
    clock:Object.freeze({initialTimeMs:input.initialTimeMs,remainingMs:input.remainingMs,
      incrementMs:input.incrementMs,movesToGo:input.movesToGo,
      explicitLimitMs:input.explicitLimitMs,elapsedMs:input.elapsedMs}),
    transportReserveMs:input.transportReserveMs,localPublicationReserveMs:null,
    localPublicationReserveSupport:'unsupported',usefulBlockAuthority:false,
    allocationPolicyAuthority:false,publicationDeadlineFromGoMs:input.elapsedMs,
    purchasedBlocksMs:Object.freeze([]),hardClockEnvelopeFromGoMs,
    safeEnvelopeFromGoMs:null,
  });
}

// Pure composition over already-admitted owner data; never calls search or
// learns population parameters. Authority and interpretation remain callers'.
export function chooseElapsedBlocks({strategy,blocks,localReserve},input){
  const reserve=localReserve+input.transportReserveMs,safeEnvelopeFromGoMs=Math.max(0,Math.min(input.remainingMs,input.explicitLimitMs??input.remainingMs)-reserve),purchasedBlocksMs=[];let deadline=input.elapsedMs;
  const result=reason=>({publicationDeadlineFromGoMs:deadline,purchasedBlocksMs,safeEnvelopeFromGoMs,reason});
  if(strategy.target_blocks===0)return result('baseline_no_discretionary_purchase');
  for(let index=0;index<strategy.target_blocks;index++){
    const block=blocks[index];if(deadline+block>safeEnvelopeFromGoMs)return result(purchasedBlocksMs.length?'next_block_unaffordable':'no_affordable_block');
    if(strategy.kind==='preserve_future_blocks_v1'&&deadline+block+strategy.future_decisions*Math.max(0,block+reserve-input.incrementMs)>safeEnvelopeFromGoMs)return result('future_capacity_reserved');
    purchasedBlocksMs.push(block);deadline+=block;
  }
  return result('target_reached');
}
