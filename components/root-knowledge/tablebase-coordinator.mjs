import {Chess} from 'chess.js';
import {createHash} from 'node:crypto';
import {actionToUci} from '../chess-domain/admission.mjs';
import {loadRootTablebaseBinding} from './tablebase-binding.mjs';
import {openRootTablebaseProvider} from './tablebase-process.mjs';

export function createTablebaseCoordinator({loadBinding=loadRootTablebaseBinding,openProvider=openRootTablebaseProvider,onStatus}={}){
 const options=[{name:'SyzygyRootProbe',type:'check',default:true,apply:'next-go'},{name:'RootTablebaseBinding',type:'string',default:'',apply:'startup'}].map(Object.freeze);
 let bindingPath='',attempted,provider,ticket,ticketKey,last,sequence=0,closed=false,closePromise,statusKey,resolution;
 const report=status=>{const key=JSON.stringify(status);if(key!==statusKey){statusKey=key;onStatus?.({schema:'vector_root_knowledge_status_v1',provider:'root-tablebase',status});}};
 const status=description=>report({state:description.status,providerGeneration:description.provider_generation??null,dataset:description.status==='ready'?{cardinality:description.provider_identity?.dataset?.admitted_cardinality,fileCount:description.provider_identity?.dataset?.file_count}:null,internalGpuProbe:'unsupported'});
 const clearResolution=()=>{if(resolution){const old=resolution;resolution=undefined;old.active=false;old.unsubscribe?.();}};
 const abandon=()=>{try{clearResolution();}finally{ticket?.abandon();ticket=undefined;ticketKey=undefined;}};
 const key=(context,searchmoves)=>JSON.stringify([context.rootEpoch,context.rootFence,context.input,searchmoves]);
 const eligible=context=>{
  if(context.terminal||!provider||provider.describe().status!=='ready')return false;
  const maximum=provider.describe().provider_identity?.dataset?.admitted_cardinality;if(!Number.isInteger(maximum)||maximum<3||maximum>6)return false;
  // External root-knowledge metadata only, never canonical state or active search.
  const board=new Chess(context.input.originFen);for(const action of context.input.moves){const move=actionToUci(action);board.move({from:move.slice(0,2),to:move.slice(2,4),promotion:move[4]});}
  return board.board().flat().filter(Boolean).length<=maximum;
 };
 const start=(context,searchmoves,enabled)=>{
  if(!enabled||!eligible(context)){abandon();return false;}
  const next=key(context,searchmoves);if(ticketKey===next)return true;abandon();
  if(sequence>=0xffff_fffe)throw new Error('Root provider request identity exhausted');
  ticket=provider.probe({context,searchmoves,requestId:`root-${++sequence}`});ticketKey=next;return true;
 };
 const read=context=>{const result=ticket?.read(context);if(!result)return null;const common={rootEpoch:context.rootEpoch,rootFence:context.rootFence,requestSha256:result.requestSha256,providerGeneration:result.providerGeneration};return result.status==='exact'?{status:'resolved',authority:'tablebase-exact-root',action:result.exactAction,...common}:{status:'constrained',authority:'tablebase-raw-wdl-root',actions:result.actions,...common,...(result.failureDisposition?{failureDisposition:result.failureDisposition}:{})};};
 return Object.freeze({options,
  configure(next){if(provider&&next!==bindingPath)throw new Error('Admitted provider binding replacement requires process restart');bindingPath=next;attempted=undefined;},
  async ready(){if(closed)throw new Error('Root tablebase closed');if(provider||attempted===bindingPath)return;attempted=bindingPath;if(!bindingPath){report({state:'unavailable',reason:'managed-provider-binding-unconfigured',internalGpuProbe:'unsupported'});return;}try{const selection=await loadBinding({file:bindingPath});provider=await openProvider({...selection,onStatus:status});status(provider.describe());}catch(error){report({state:'unavailable',reason:'managed-provider-admission-failed',message:String(error.message).slice(0,256),internalGpuProbe:'unsupported'});}},
  onPosition(context,enabled){last=undefined;try{start(context,[],enabled);}catch(error){report({state:'unavailable',reason:'root-request-unavailable',message:String(error.message).slice(0,256)});}},
  prepare({context,requestId,searchmoves,enabled}){clearResolution();let applicable=false;try{applicable=start(context,searchmoves,enabled);}catch(error){report({state:'unavailable',reason:'root-request-unavailable',message:String(error.message).slice(0,256)});}last={context,requestId};return {applicable,result:read(context)};},
  subscribeResolution({context,requestId},callback){clearResolution();if(typeof callback!=='function'||!last||last.requestId!==requestId||key(last.context,[])!==key(context,[]))throw new Error('Current root resolution subscription unavailable');const binding={active:true};resolution=binding;const changed=()=>{if(!binding.active||closed||!last||last.requestId!==requestId||key(last.context,[])!==key(context,[]))return;const result=read(context);if(result?.status==='resolved'){try{Promise.resolve(callback(result)).catch(()=>{});}catch{}}};const unsubscribe=ticket?.subscribe?.(changed);if(binding.active)binding.unsubscribe=unsubscribe;else unsubscribe?.();return()=>{if(resolution===binding)clearResolution();};},
  publication({context,requestId}){if(!last||last.requestId!==requestId||key(last.context,[])!==key(context,[]))return null;return read(context);},
  endGame(){abandon();last=undefined;},
  close(){if(!closePromise){closed=true;closePromise=(async()=>{abandon();last=undefined;const receipt=await provider?.close();return {schema:'vector_root_knowledge_teardown_v1',noProviderOpened:!provider,...(receipt?{provider:receipt.provider,process:receipt.process,stderr:{bytes:Buffer.byteLength(receipt.stderr??''),sha256:createHash('sha256').update(receipt.stderr??'').digest('hex')}}:{})};})();}return closePromise;}
 });
}
