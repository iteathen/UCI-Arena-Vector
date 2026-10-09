import assert from 'node:assert/strict';
import test from 'node:test';
import {createGameSearchPort} from '../../components/engine-runtime/game-search-port.mjs';
import {STATE_WORDS} from '../../components/chess-domain/admission.mjs';
import {createHash} from 'node:crypto';
const fen='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
function fixture(){
 const calls=[],command={phase:0,result:1,kind:2,expectedArena:3,expectedFocusEpoch:4,expectedRootSlot:5,expectedRootGeneration:6,idBase:8,generationBase:12,responseRootSlot:16,responseRootGeneration:17,responseFocusEpoch:18,stateWords:20,admissionActionCount:21,actionWords:22,stateBase:32,kinds:{admit:1,cancel:3},phases:{uploading:1,pending:2,acknowledged:3},results:{accepted:0,pressure:2}};
 const core={layout:{stateWords:STATE_WORDS,actionWords:1,maxAdmissionActions:4096,maxActions:256},protocol:{command,packetWords:32+STATE_WORDS+4096,bootstrap:{wordCount:4,status:0,rootSlot:1,rootGeneration:2,focusEpoch:3,acceptedStatus:0},observer:{status:0,statuses:{ready:0},authority:{arena:2,root:3,generation:4,epoch:5},actionCount:6,terminal:7,selectedActionBase:12,rowsBase:32,rowWords:6},telemetry:{},terminal:{headerWords:32,identityWords:4,fields:{acceptedCommandIdBase:24,acceptedCommandGenerationBase:28},quiescence:{zeroFields:[12,13,14,15,16,21,22],equalPairs:[[17,18],[19,20]]}}},operationIds:{bootstrap:'boot',command:'cmd',observer:'observe'},delivery:{id:'terminal'},programResources:[{id:'gpu',materialization:'resident-storage',capacity:String((32+STATE_WORDS+4096)*4)}],buffers:[{name:'initialRootInput',source:{resource:'gpu'},byteOffset:0,byteLength:(32+STATE_WORDS+4096)*4}]};
 let epoch=1,cancel,stale=false,unavailable=0;
 const prepared={async describe(){return{};},async ignite(input){assert(!Object.hasOwn(input,'resources'),'Cold full images must be preinitialized before readiness');assert(input.initializationParameters['operation-3'].initialRootInput instanceof Uint8Array);calls.push('ignite');return {initializationResults:[{bytes:new Uint8Array(new Uint32Array([0,3,4,epoch]).buffer)}]};},async submitExternal(op,input){calls.push(op);let w;
  if(op==='operation-4'){const packet=new Uint32Array(input.parameters.commandStage.buffer);w=new Uint32Array(32);w[0]=3;w.set(packet.slice(8,16),8);if(packet[2]===3)cancel={id:[...packet.slice(8,12)],generation:[...packet.slice(12,16)]};else epoch++;w[16]=3;w[17]=4;w[18]=epoch;
  }else{w=new Uint32Array(1568);if(unavailable>0){w[0]=1;unavailable--;}w[2]=input.scalars.arena;w[3]=stale?9:3;w[4]=4;w[5]=epoch;w[6]=1;w[12]=w[32]=796;}
  return {async wait(){},async deliver(){return {bytes:new Uint8Array(w.buffer)};},async close(){calls.push('child-close');}};
 },async wait(){calls.push('join');},async deliver(){const w=new Uint32Array(32);w.set(cancel.id,24);w.set(cancel.generation,28);return {bytes:new Uint8Array(w.buffer)};},async close(){calls.push('close');return {status:'complete',failures:[],runtime:{graceful:true,driver:{resourceCounts:{live:0,orphaned:0}}}};}};
 const requirements={resourceRequirements:[{id:'resource-0',byteLength:String(core.buffers[0].byteLength)}],operationRequirements:[{bindings:[{parameter:'initialRootInput',source:{kind:'resource',resource:'resource-0',view:{dtype:'u32',byteOffset:'0',elementCount:String(core.protocol.packetWords)}}}]}],deliveryRequirements:[]};
 const backend={core,requirements,ports:{operationIds:{bootstrap:'operation-3',command:'operation-4',observer:'operation-5'},deliveryId:'delivery-0'},prepared,assets:{},selected:{artifactBindings:{}},cold:{model:{connector:{parameters:[]}}},description:{admission:{realization:'prepared'}}};
 return {calls,backend,setUnavailable(n){unavailable=n;},setStale(){stale=true;},async prepare({modelRoot}){if(modelRoot.endsWith('bad'))throw new Error('Rejected model');return backend;}};
}
test('protocol adapter ignites once, observes GPU-selected rows and joins exact cancel before close',async()=>{
 const f=fixture(),p=createGameSearchPort({modelRoot:'good',revision:'a'.repeat(40),prepare:f.prepare});await p.ready();await p.admitPosition({fen,moves:[],rootEpoch:1});assert.equal(p.readRootKnowledgeContext().rootEpoch,1);assert.equal(p.readPublication({rootEpoch:1,requestId:1}),null);await p.requestPublication({rootEpoch:1,requestId:1});assert.equal(p.readPublication({rootEpoch:1,requestId:1}).action,796);assert.equal(p.readPublication({rootEpoch:2,requestId:1}),null);assert.deepEqual(p.readRootKnowledgeContext().rootFence,[1,3,4,1]);assert.deepEqual(p.readRootKnowledgeContext().legalActions,[796]);
 await p.admitPosition({fen,moves:[],rootEpoch:2});assert.equal(p.readRootKnowledgeContext().rootEpoch,2);assert.equal(f.calls.filter(c=>c==='ignite').length,1);await p.close();assert(f.calls.indexOf('join')<f.calls.indexOf('close'));assert.equal(p.readRootKnowledgeContext(),null);await p.close();assert.equal(f.calls.filter(c=>c==='close').length,1);
});
test('rejected replacement keeps admitted prepared configuration; publication stale fence fails closed',async()=>{
 const f=fixture(),p=createGameSearchPort({modelRoot:'good',revision:'a'.repeat(40),prepare:f.prepare}),identity=await p.ready();await assert.rejects(p.configure({name:'ModelRoot',value:'bad'}),/Rejected model/);assert.equal(await p.ready(),identity);assert.equal(f.calls.includes('close'),false);await p.admitPosition({fen,moves:[],rootEpoch:1});f.setStale();await assert.rejects(p.requestPublication({rootEpoch:1,requestId:1}),/authority/);assert.equal(p.readPublication({rootEpoch:1,requestId:1}),null);await p.close();
});
test('close waits for delayed readiness admission and disposes the returned candidate',async()=>{
 const f=fixture();let release,entered;const entering=new Promise(resolve=>entered=resolve),held=new Promise(resolve=>release=resolve);
 const p=createGameSearchPort({modelRoot:'good',revision:'a'.repeat(40),prepare:async()=>{entered();await held;return f.backend;}});
 const readiness=p.ready();await entering;let settled=false;const closing=p.close().then(report=>{settled=true;return report;});await new Promise(resolve=>setImmediate(resolve));assert.equal(settled,false);release();await assert.rejects(readiness,/closed/);const report=await closing;assert.equal(f.calls.filter(c=>c==='close').length,1);assert.notEqual(report.noRuntimeOpened,true);await assert.rejects(p.ready(),/closed/);
});
test('close waits for delayed replacement and releases candidate without replacing closed owner',async()=>{
 const old=fixture(),next=fixture();let release,entered;const entering=new Promise(resolve=>entered=resolve),held=new Promise(resolve=>release=resolve);
 const p=createGameSearchPort({modelRoot:'good',revision:'a'.repeat(40),prepare:async({modelRoot})=>{if(modelRoot.endsWith('replacement')){entered();await held;return next.backend;}return old.backend;}});
 await p.ready();const replacement=p.configure({name:'ModelRoot',value:'replacement'});await entering;let settled=false;const closing=p.close().then(report=>{settled=true;return report;});await new Promise(resolve=>setImmediate(resolve));assert.equal(settled,false);release();await assert.rejects(replacement,/closed/);await closing;assert.equal(next.calls.filter(c=>c==='close').length,1);assert.equal(old.calls.filter(c=>c==='close').length,1);await assert.rejects(p.ready(),/closed/);
});
test('delayed replacement cannot retire a game admitted while candidate preparation was pending',async()=>{
 const old=fixture(),next=fixture();let release,entered;const entering=new Promise(resolve=>entered=resolve),held=new Promise(resolve=>release=resolve);
 const p=createGameSearchPort({modelRoot:'good',revision:'a'.repeat(40),prepare:async({modelRoot})=>{if(modelRoot.endsWith('replacement')){entered();await held;return next.backend;}return old.backend;}});
 await p.ready();const replacement=p.configure({name:'ModelRoot',value:'replacement'});await entering;await p.admitPosition({fen,moves:[],rootEpoch:1});release();await assert.rejects(replacement,/game/);assert.equal(old.calls.includes('close'),false);assert.equal(next.calls.filter(c=>c==='close').length,1);await p.close();assert.equal(old.calls.filter(c=>c==='ignite').length,1);
});

test('quit after a joined game retirement declares no active runtime and retains the proved close',async()=>{
 const f=fixture(),p=createGameSearchPort({modelRoot:'good',revision:'a'.repeat(40),prepare:f.prepare});await p.ready();await p.admitPosition({fen,moves:[],rootEpoch:1});const retired=await p.endGame();assert.equal(retired.joined,true);const report=await p.close();assert.equal(report.noActiveRuntime,true);assert.equal(report.noRuntimeOpened,false);assert.equal(report.gameTeardowns.length,1);assert.equal(report.gameTeardowns[0],retired);assert.equal(f.calls.filter(c=>c==='close').length,1);
});

test('closure journal retains bounded recent proof after seventy games with finite historical disposition',async()=>{
 const p=createGameSearchPort({modelRoot:'good',revision:'a'.repeat(40),prepare:async()=>fixture().backend});for(let i=0;i<70;i++){await p.ready();await p.admitPosition({fen,moves:[],rootEpoch:i+1});await p.endGame();}const report=await p.close();assert.equal(report.gameTeardowns.length,8);assert.equal(report.closureJournal.capacity,8);assert.equal(report.closureJournal.totalRetirements,70);assert.equal(report.closureJournal.totalJoined,70);assert.equal(report.closureJournal.evictedRetirements,62);assert.equal(report.closureJournal.evictedJoined,62);assert.match(report.closureJournal.chainSha256,/^[0-9a-f]{64}$/);assert.equal(report.noActiveRuntime,true);assert(JSON.stringify(report).length<32768);
});

test('temporary immutable snapshot unavailability retries only read-only observation and fails closed at finite bound',async()=>{
 const f=fixture(),p=createGameSearchPort({modelRoot:'good',revision:'a'.repeat(40),prepare:f.prepare});await p.admitPosition({fen,moves:[],rootEpoch:1});f.setUnavailable(2);await p.requestPublication({rootEpoch:1,requestId:1});assert.equal(p.readPublication({rootEpoch:1,requestId:1}).action,796);f.setUnavailable(3);await assert.rejects(p.requestPublication({rootEpoch:1,requestId:2}),/snapshot.*unavailable/i);assert.equal(p.readPublication({rootEpoch:1,requestId:2}),null);assert.equal(f.calls.filter(c=>c==='ignite').length,1);await p.close();
});

test('retained closure chain independently recomputes from the declared predecessor anchor',async()=>{
 const p=createGameSearchPort({modelRoot:'good',revision:'a'.repeat(40),prepare:async()=>fixture().backend});for(let i=0;i<10;i++){await p.ready();await p.admitPosition({fen,moves:[],rootEpoch:i+1});await p.endGame();}const r=await p.close();assert.match(r.closureJournal.retainedPredecessorSha256,/^[0-9a-f]{64}$/);assert.notEqual(r.closureJournal.retainedPredecessorSha256,'0'.repeat(64));let hash=r.closureJournal.retainedPredecessorSha256;for(const receipt of r.gameTeardowns)hash=createHash('sha256').update(hash).update(JSON.stringify(receipt)).digest('hex');assert.equal(hash,r.closureJournal.chainSha256);
});
test('root knowledge resolves one fenced move but final emission still requires canonical GPU restriction proof',async()=>{
 const f=fixture(),knowledge={options:[{name:'OwnBook',type:'check',default:true,apply:'next-go'}],hasOption:n=>n==='OwnBook',async ready(){},async beginGame(){},async endGame(){},async close(){},async configure(){},async prepare({context}){return {status:'resolved',authority:'book-resolved',action:796,rootEpoch:context.rootEpoch,rootFence:context.rootFence};}},p=createGameSearchPort({modelRoot:'good',revision:'a'.repeat(40),prepare:f.prepare,knowledge});await p.admitPosition({fen,moves:[],rootEpoch:1});assert.equal((await p.preparePublicationIntent({rootEpoch:1,requestId:1,options:{OwnBook:true}})).bypassPublicationWait,true);await p.requestPublication({rootEpoch:1,requestId:1});assert.equal(p.readPublication({rootEpoch:1,requestId:1}).action,796);await p.close();
});
