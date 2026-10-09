import path from 'node:path';
import {createHash} from 'node:crypto';
import mcgsPackage from 'cuda-mcgs/package.json' with {type:'json'};
import {admitPosition as admitFen} from '../chess-domain/admission.mjs';
import {MODEL_IDENTITY} from './model-artifacts.mjs';
import {prepareChessBackend,PUBLIC_PEER,NATIVE_RUNTIME_OPTIONS} from './gpu-backend.mjs';
import {encodeSessionPacket,decodeSessionReply,assertTerminalQuiescence} from './game-search-packets.mjs';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const words=bytes=>new Uint32Array(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
const digits=n=>{if(n<1n||n>=0xffff_ffff_ffff_ffff_ffff_ffff_ffff_ffffn)throw new Error('Command identity exhausted');return Array.from({length:4},(_,i)=>Number((n>>BigInt(i*32))&0xffff_ffffn));};
function runtimeIdentity(backend,revision){
 const admission=backend.description.admission;
 if(mcgsPackage.name!=='cuda-mcgs'||mcgsPackage.version!=='0.0.0-dev.2')throw new Error('Selected operational MCGS package identity mismatch');
 return Object.freeze({schema:'vector_engine_runtime_identity_v1',nodeVersion:process.versions.node,vectorRevision:revision,model:{modelId:'compact_chessformer_gab_v1',checkpointSha256:MODEL_IDENTITY.checkpointSha256,parametersSha256:MODEL_IDENTITY.parameterSha256,constantsSha256:MODEL_IDENTITY.constantsSha256},cohort:{cudaJs:PUBLIC_PEER,tensor:{package:'cuda-js-tensor@0.1.0-alpha.10',revision:'759a1a07b8ca9a5934673aeb20864e52ad800b6e'},mcgs:{package:'cuda-mcgs@0.0.0-dev.2',archiveSha256:'9fceef095e7f62bc7b1098424688203703a6afbf724583b1d9ee3507d48b3550'}},admission:{realization:admission.realization,identity:{algorithm:'sha256',sha256:createHash('sha256').update(JSON.stringify(admission)).digest('hex')},executionPackage:admission.executionPackage,semanticProgram:admission.semanticProgram},device:backend.description.runtime?.device,lowerProfile:backend.description.runtime?.profile,runtimePolicy:NATIVE_RUNTIME_OPTIONS.driver,searchQualification:'candidate-unqualified'});
}
export function createGameSearchPort({modelRoot='models/default',revision,prepare=prepareChessBackend,cacheDirectory}={}){
 let configuredRoot=path.resolve(modelRoot),backend,readyPromise,authority,admittedInput,game=false,sequence=0n,arena=0,external=Promise.resolve(),coldOwnership=Promise.resolve(),snapshot,hostEpoch=0,closed=false,closePromise,identity,teardowns=[],coldCleanupFailures=[];
 const serialize=fn=>{const op=external.then(fn);external=op.catch(()=>{});return op;};
 const serializeCold=fn=>{const op=coldOwnership.then(fn);coldOwnership=op.catch(()=>{});return op;};
 const closureJournal={schema:'vector_closure_journal_v1',capacity:8,scope:'latest-proved-retirements-with-historical-disposition',totalRetirements:0,totalJoined:0,evictedRetirements:0,evictedJoined:0,chainSha256:'0'.repeat(64)};
 const retainClose=receipt=>{if(closureJournal.totalRetirements>=0xffff_fffe)throw new Error('Closure journal disposition counter exhausted');closureJournal.totalRetirements++;if(receipt.joined)closureJournal.totalJoined++;closureJournal.chainSha256=createHash('sha256').update(closureJournal.chainSha256).update(JSON.stringify(receipt)).digest('hex');teardowns.push(receipt);if(teardowns.length>closureJournal.capacity){const old=teardowns.shift();closureJournal.evictedRetirements++;if(old.joined)closureJournal.evictedJoined++;}};
 const validateCleanup=cleanup=>{if(cleanup.status!=='complete'||cleanup.failures?.length||cleanup.runtime?.graceful!==true||cleanup.runtime.driver?.resourceCounts?.live!==0||cleanup.runtime.driver?.resourceCounts?.orphaned!==0)throw new Error('Actual public runtime teardown not proved');};
 const disposeCandidate=async candidate=>{try{const cleanup=await candidate.prepared.close();validateCleanup(cleanup);retainClose({schema:'vector_engine_teardown_v1',joined:false,disposition:'cold-admission-retired',cleanup});}catch(error){coldCleanupFailures.push(error);throw error;}};
 const initialize=async root=>{if(closed)throw new Error('GameSearchPort closed');const candidate=await prepare({modelRoot:root,cacheDirectory,revision});if(closed){await disposeCandidate(candidate);throw new Error('GameSearchPort closed during preparation');}try{const nextIdentity=runtimeIdentity(candidate,revision);if(JSON.stringify(nextIdentity).length>16384)throw new Error('Runtime identity exceeds UCI extent');return {candidate,nextIdentity};}catch(error){await disposeCandidate(candidate);throw error;}};
 const ready=async()=>{if(closed)throw new Error('GameSearchPort closed');if(!readyPromise)readyPromise=serializeCold(async()=>{if(!backend){const {candidate,nextIdentity}=await initialize(configuredRoot);backend=candidate;identity=nextIdentity;}return identity;});return readyPromise;};
 const child=async(op,inputs)=>{const c=await backend.prepared.submitExternal(op,inputs);try{await c.wait();return await c.deliver();}finally{await c.close();}};
 const command=async(kind,state,actions=[])=>{
  const token={id:digits(++sequence),generation:digits(sequence)},base={kind,authority,id:token.id,generation:token.generation,state,actions},started=performance.now();
  let reply=await child(backend.ports.operationIds.command,{parameters:{commandStage:encodeSessionPacket(backend.core,base)}});
  for(;;){const parsed=decodeSessionReply(backend.core,reply.bytes,token);if(!parsed.pending)return {...parsed,token};if(performance.now()-started>30000)throw new Error('GPU Session acknowledgement bound exceeded');await delay(5);reply=await child(backend.ports.operationIds.command,{parameters:{commandStage:encodeSessionPacket(backend.core,{...base,poll:true})}});}
 };
 const observe=async({rootEpoch,requestId,searchmoves=[]})=>{
   if(!game||rootEpoch!==hostEpoch)throw new Error('Publication root epoch stale');const O=backend.core.protocol.observer;if(!O)throw new Error('Canonical Output public descriptor unavailable');const restriction=new Uint32Array(backend.core.layout.maxActions+1);if(searchmoves.length>backend.core.layout.maxActions||searchmoves.some(a=>!Number.isInteger(a)||a<0||a>0x7fff))throw new Error('Publication restriction extent invalid');restriction[0]=searchmoves.length;restriction.set(searchmoves,1);
   let w;snapshot=null;for(let attempt=0;attempt<3;attempt++){const payload=await child(backend.ports.operationIds.observer,{parameters:{restriction:new Uint8Array(restriction.buffer)},scalars:{arena:authority.arena,root:authority.root,generation:authority.generation,epoch:authority.epoch}});w=words(payload.bytes);if(w[O.status]===O.statuses.ready)break;if(attempt===2)throw new Error('Immutable GPU snapshot unavailable after bounded read-only attempts');}
   for(const [key,index]of Object.entries(O.authority))if(w[index]!==authority[key])throw new Error('GPU publication authority mismatch');
   const count=w[O.actionCount],terminal=w[O.terminal]===1;if(count>backend.core.layout.maxActions||(!count&&!terminal))throw new Error('GPU publication legal candidate envelope invalid');const action=count?w[O.selectedActionBase]:null;
   if(action!==null&&(!Array.from({length:count},(_,i)=>w[O.rowsBase+i*O.rowWords]).includes(action)||(searchmoves.length&&!searchmoves.includes(action))))throw new Error('GPU selected action lacks canonical ready proof or violates publication restriction');
   snapshot={rootEpoch,requestId,action,legalActions:Object.freeze(Array.from({length:count},(_,i)=>w[O.rowsBase+i*O.rowWords])),legalProof:{rootEpoch,action,legal:true},terminal,authority:{...authority},telemetry:Object.fromEntries(Object.entries(backend.core.protocol.telemetry).filter(([,d])=>d&&typeof d==='object'&&Number.isInteger(d.word)).map(([name,d])=>[name,{value:w[d.word],scope:d.scope,meaning:d.meaning}]))};

 };
 const retire=async()=>{
  if(!backend)return {schema:'vector_engine_teardown_v1',joined:false,noActiveRuntime:true,noRuntimeOpened:teardowns.length===0};
  let terminal,cancel;
  if(game){const result=await command(backend.core.protocol.command.kinds.cancel);cancel=result.token;await backend.prepared.wait();terminal=await backend.prepared.deliver(backend.ports.deliveryId);assertTerminalQuiescence(backend.core,terminal.bytes,cancel);}
  const cleanup=await backend.prepared.close();validateCleanup(cleanup);
  const receipt={schema:'vector_engine_teardown_v1',joined:game,gameArena:game?arena:null,semantic:terminal?assertTerminalQuiescence(backend.core,terminal.bytes,cancel):null,cleanup};retainClose(receipt);backend=undefined;readyPromise=undefined;authority=undefined;game=false;snapshot=undefined;return receipt;
 };
 return Object.freeze({options:[Object.freeze({name:'ModelRoot',type:'string',default:modelRoot})],ready,
  async configure({name,value}){if(closed||game)throw new Error('Cannot replace admitted game configuration');if(name!=='ModelRoot'||typeof value!=='string'||!value.trim()||/[\x00-\x1f\x7f]/.test(value))throw new Error('Invalid ModelRoot option');return serializeCold(async()=>{if(closed||game)throw new Error('GameSearchPort closed or game admitted during configuration');const nextRoot=path.resolve(value);if(!backend){configuredRoot=nextRoot;readyPromise=undefined;return;}const {candidate,nextIdentity}=await initialize(nextRoot);return serialize(async()=>{if(closed||game){await disposeCandidate(candidate);throw new Error('GameSearchPort closed or game admitted during configuration');}try{await retire();}catch(error){await disposeCandidate(candidate);throw error;}if(closed){await disposeCandidate(candidate);throw new Error('GameSearchPort closed during configuration');}backend=candidate;identity=nextIdentity;configuredRoot=nextRoot;readyPromise=Promise.resolve(identity);});});},
  admitPosition({fen,moves=[],rootEpoch}){return serialize(async()=>{await ready();const state=admitFen(fen).words;snapshot=undefined;
   if(!game){if(arena>=0xffff_fffd)throw new Error('Game arena exhausted');arena++;const packet=encodeSessionPacket(backend.core,{kind:backend.core.protocol.command.kinds.admit,id:digits(++sequence),generation:digits(sequence),state,actions:moves});const result=await backend.prepared.ignite({initializationParameters:{[backend.ports.operationIds.bootstrap]:{initialRootInput:packet}},scalars:{[backend.ports.operationIds.bootstrap]:{arena}}});const B=backend.core.protocol.bootstrap,w=words(result.initializationResults[0].bytes);if(w.length!==B.wordCount||w[B.status]!==B.acceptedStatus)throw new Error('Actual cold GPU authority missing');authority={arena,root:w[B.rootSlot],generation:w[B.rootGeneration],epoch:w[B.focusEpoch]};game=true;
   }else{const result=await command(backend.core.protocol.command.kinds.admit,state,moves);authority={arena,...result.authority};}
   hostEpoch=rootEpoch;admittedInput=Object.freeze({originFen:fen,moves:Object.freeze([...moves])});await observe({rootEpoch,requestId:0});return {rootEpoch,sideToMove:(state[64]+moves.length)%2};});},
  requestPublication({rootEpoch,requestId,searchmoves=[]}){return serialize(async()=>{
   await observe({rootEpoch,requestId,searchmoves});
  });},
  readPublication({rootEpoch,requestId}){return snapshot?.rootEpoch===rootEpoch&&snapshot.requestId===requestId?snapshot:null;},
  readRootKnowledgeContext(){if(!game||!snapshot||snapshot.rootEpoch!==hostEpoch)return null;return Object.freeze({schema:'vector_root_knowledge_context_v1',claimPolicy:'orthodoxy-live-claims-v1',rootEpoch:hostEpoch,rootFence:Object.freeze([authority.arena,authority.root,authority.generation,authority.epoch]),input:admittedInput,legalActions:snapshot.legalActions,terminal:snapshot.terminal});},
  endGame(){return serialize(retire);},
  close(){if(!closePromise){closed=true;closePromise=(async()=>{await coldOwnership;return serialize(async()=>{const receipt=await retire();if(coldCleanupFailures.length)throw new AggregateError(coldCleanupFailures,'Cold candidate teardown failed');return {...receipt,gameTeardowns:teardowns,closureJournal:{...closureJournal}};});})();}return closePromise;}
 });
}
