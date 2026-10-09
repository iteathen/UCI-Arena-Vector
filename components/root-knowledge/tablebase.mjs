import {createHash} from 'node:crypto';
import {actionToUci} from '../chess-domain/admission.mjs';

export function canonicalJson(value){
 if(value===null||typeof value==='boolean'||typeof value==='string')return JSON.stringify(value);
 if(typeof value==='number'){if(!Number.isSafeInteger(value))throw new Error('Canonical provider request requires finite integers');return String(value);}
 if(Array.isArray(value))return '['+value.map(canonicalJson).join(',')+']';
 if(value&&Object.getPrototypeOf(value)===Object.prototype)return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonicalJson(value[k])).join(',')+'}';
 throw new Error('Unsupported canonical provider JSON value');
}
const digest=value=>createHash('sha256').update(canonicalJson(value)).digest('hex');
const freeze=value=>{if(value&&typeof value==='object'){for(const item of Object.values(value))freeze(item);Object.freeze(value);}return value;};
const same=(a,b)=>canonicalJson(a)===canonicalJson(b);
const uniqueMoves=(moves,allowed)=>Array.isArray(moves)&&moves.length<=256&&new Set(moves).size===moves.length&&moves.every(m=>allowed.includes(m));
const fence=context=>{if(!Array.isArray(context?.rootFence)||context.rootFence.length!==4||context.rootFence.some(w=>!Number.isInteger(w)||w<0||w>0xffff_fffe))throw new Error('Actual GPU root fence required');return context.rootFence.map(w=>w.toString(16).padStart(8,'0')).join('');};
export function createTablebaseTicket({context,requestId,description,searchmoves=[],limits={max_nodes:16384,max_depth:128,max_milliseconds:1000}}){
 if(context?.schema!=='vector_root_knowledge_context_v1'||context.claimPolicy!=='orthodoxy-live-claims-v1')throw new Error('Explicit Vector live claim policy required');
 if(description?.schema!=='uci_arena_syzygy_root_transport_v1'||description.operation!=='describe'||description.status!=='ready'||description.profile?.root_only!==true||description.profile.worker_count!==1||description.profile.ticket_capacity!==2||description.profile.request_schema!=='uci_arena_syzygy_root_request_v2'||!description.profile.claim_policies?.['orthodoxy-live-claims-v1']?.rule50?.includes(true)||!/^[0-9a-f]{32}$/.test(description.provider_generation))throw new Error('Public root-only provider readiness required');
 if(typeof requestId!=='string'||!requestId.length||requestId.length>128||!/^[A-Za-z0-9_.-]+$/.test(requestId))throw new Error('Bounded request identity required');
 const input=context.input;if(typeof input?.originFen!=='string'||input.originFen.length>256||!Array.isArray(input.moves)||input.moves.length>4096||!Array.isArray(context.legalActions)||context.legalActions.length>256||new Set(context.legalActions).size!==context.legalActions.length)throw new Error('Complete admitted root input and legal set required');
 const legal=context.legalActions.map(actionToUci),restrictions=searchmoves.map(actionToUci);if(!uniqueMoves(restrictions,legal))throw new Error('Root publication restrictions lack GPU legal proof');
 if(!limits||Object.keys(limits).sort().join(',')!=='max_depth,max_milliseconds,max_nodes'||!Number.isInteger(limits.max_nodes)||limits.max_nodes<1||limits.max_nodes>16384||!Number.isInteger(limits.max_depth)||limits.max_depth<1||limits.max_depth>128||!Number.isInteger(limits.max_milliseconds)||limits.max_milliseconds<1||limits.max_milliseconds>1000)throw new Error('Provider proof limits outside declared bounds');
 const request=freeze({schema:'uci_arena_syzygy_root_request_v2',request_id:requestId,root_fence:fence(context),position:{origin_fen:input.originFen,moves:input.moves.map(actionToUci)},legal_moves:legal,searchmoves:restrictions.length?restrictions:null,rules:{rule50:true,repetition:'threefold-as-draw',claim_policy:'orthodoxy-live-claims-v1'},history_mode:'replay-from-origin',limits:{...limits}});
 if(Buffer.byteLength(canonicalJson(request))>262144)throw new Error('Provider request extent exceeded');
 const requestSha256=digest(request),providerIdentity=canonicalJson(description.provider_identity),allowed=restrictions.length?legal.filter(m=>restrictions.includes(m)):legal,moveAction=new Map(context.legalActions.map((a,i)=>[legal[i],a]));let abandoned=false,failed=false,sequence=-1,safe,exactAction=null,observer;
 const notify=()=>{if(observer){try{Promise.resolve(observer.callback()).catch(()=>{});}catch{}}};
 return Object.freeze({request,requestSha256,
  subscribe(callback){if(typeof callback!=='function')throw new Error('Ticket observer callable required');const current={callback};observer=current;if(sequence>=0&&!abandoned)notify();return()=>{if(observer===current)observer=undefined;};},
  abandon(){abandoned=true;safe=undefined;exactAction=null;observer=undefined;},
  fail(){if(!failed){failed=true;exactAction=null;notify();}},
  accept(event){
   if(abandoned||failed)return;
   if(event?.schema!=='uci_arena_syzygy_root_result_v2'||event.request_id!==requestId||event.root_fence!==request.root_fence||event.request_sha256!==requestSha256||event.provider_generation!==description.provider_generation||canonicalJson(event.provider_identity)!==providerIdentity||!same(event.rules,request.rules))throw new Error('Tablebase result binding mismatch');
   if(!Number.isInteger(event.sequence)||event.sequence<0||event.sequence>1||event.sequence!==sequence+1)throw new Error('Tablebase result sequence mismatch');
   if(!['miss','not_applicable','deferred','safety_only','exact'].includes(event.status))throw new Error('Unknown tablebase result status');
   if(event.authority?.raw_wdl_safety===true){
    if(!uniqueMoves(event.safe_moves,allowed)||!event.safe_moves.length||event.raw?.zero_clock_abstraction!==true||!Array.isArray(event.raw.rows)||event.raw.rows.length!==allowed.length||!uniqueMoves(event.raw.rows.map(r=>r.move),allowed)||event.raw.rows.some(r=>![-2,-1,0,1,2].includes(r.wdl)||![-1,0,1].includes(r.result_class)||r.result_class!==(r.wdl===2?1:r.wdl===-2?-1:0)))throw new Error('Incomplete raw tablebase safety');
    const best=Math.max(...event.raw.rows.map(r=>r.result_class)),proved=event.raw.rows.filter(r=>r.result_class===best).map(r=>r.move);if(!same([...proved].sort(),[...event.safe_moves].sort()))throw new Error('Raw safety subset contradicts complete rows');
    if(safe&&(!same(safe,event.safe_moves)))throw new Error('Tablebase refinement broadened or changed completed safety');
    const nextExact=event.status==='exact';if(nextExact&&(event.sequence!==1||event.authority.history_adjusted!==true||event.authority.exact_move!==true||event.refinement?.status!=='complete'||!event.safe_moves.includes(event.move)||![-1,0,1].includes(event.result_class)||!uniqueMoves(event.refinement.rows?.map(r=>r.move),allowed)||event.refinement.rows.length!==allowed.length))throw new Error('Incomplete exact root proof');
    if(nextExact){const rows=event.refinement.rows;if(event.refinement.metric!=='reversible-minimax-plies-to-zeroing-or-mate'||rows.some(r=>![-1,0,1].includes(r.result_class)||!Number.isInteger(r.boundary_plies)||r.boundary_plies<0||r.boundary_plies>request.limits.max_depth+1))throw new Error('Invalid exact root proof class or metric distance');const bestClass=Math.max(...rows.map(r=>r.result_class));let ranked=rows.filter(r=>r.result_class===bestClass);if(bestClass!==0){const distance=(bestClass===1?Math.min:Math.max)(...ranked.map(r=>r.boundary_plies));ranked=ranked.filter(r=>r.boundary_plies===distance);}const selected=allowed.find(m=>ranked.some(r=>r.move===m));if(event.result_class!==bestClass||event.move!==selected)throw new Error('Exact root outcome-first rank contradicts canonical proof rows');}
    if(!nextExact&&(event.authority.exact_move!==false||event.move!==null))throw new Error('Raw safety cannot acquire exact move authority');
    safe=[...event.safe_moves];exactAction=nextExact?moveAction.get(event.move):null;
   }else if(event.safe_moves!==null||event.move!==null||event.authority?.exact_move!==false||safe)throw new Error('Unavailable result cannot alter completed safety');
   sequence=event.sequence;notify();
  },
  read(current){if(abandoned||!safe||current?.rootEpoch!==context.rootEpoch||fence(current)!==request.root_fence||!same(current.input,input)||!same(current.legalActions,context.legalActions))return null;return {status:exactAction===null?'safety-only':'exact',actions:safe.map(m=>moveAction.get(m)),exactAction,requestId,requestSha256,providerGeneration:description.provider_generation,...(failed?{failureDisposition:'completed-raw-safety-retained'}:{})};}
 });
}
