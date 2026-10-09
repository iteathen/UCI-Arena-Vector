import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import {createGameSearchPort} from '../../components/engine-runtime/game-search-port.mjs';
import {createRootKnowledgeCoordinator} from '../../components/root-knowledge/coordinator.mjs';
import {openRootTablebaseProvider} from '../../components/root-knowledge/tablebase-process.mjs';
import {captureNativeObservation,assertJoinedObservation,assertExternalObservation,sha} from '../root-knowledge/native-observation.mjs';
import {uciToAction} from '../../components/uci-protocol/index.mjs';
import selection from '../../contracts/root-tablebase-selection.json' with {type:'json'};
const delay=ms=>new Promise(r=>setTimeout(r,ms));

test('actual public engine keeps managed provider across games and emits configured exact authority with cached GPU canonical legality',{skip:process.env.VECTOR_MANAGED_KNOWLEDGE_NATIVE!=='1'},async()=>{
 const bindingPath=process.env.VECTOR_TB_BINDING_OUTPUT,receiptPath=process.env.VECTOR_MANAGED_KNOWLEDGE_RECEIPT;
 assert(bindingPath&&receiptPath&&process.env.VECTOR_TB_PACKAGE_ROOT&&process.env.VECTOR_TB_CONFIG);
 const {bindingBytes,...metadata}=await captureNativeObservation({selection,providerRoot:process.env.VECTOR_TB_PACKAGE_ROOT,configPath:process.env.VECTOR_TB_CONFIG}),revision=metadata.sourceRevision;
 assert.deepEqual([...metadata.configuration.selectedFiles].sort(),['KQvK.rtbw','KQvK.rtbz'],'Managed proof scope requires exact KQ-only configuration');
 await fs.writeFile(bindingPath,bindingBytes,{flag:'wx'});assert.equal(sha(await fs.readFile(bindingPath)),metadata.bindingBytesSha256);
 const statuses=[],probes=[];let actualProvider;
 // Observe the existing public provider/ticket port without changing ownership,
 // requests, callbacks, exact authority or cached GPU canonical legality.
 const knowledge=createRootKnowledgeCoordinator({onStatus:e=>statuses.push(e),openTablebaseProvider:async options=>{
  actualProvider=await openRootTablebaseProvider(options);
  return Object.freeze({...actualProvider,probe(input){const ticket=actualProvider.probe(input);assert(probes.length<16,'Bounded native request journal');probes.push({request:ticket.request,requestSha256:ticket.requestSha256,providerGeneration:actualProvider.describe().provider_generation,rootContext:input.context});return ticket;}});
 }});
 const port=createGameSearchPort({modelRoot:process.env.VECTOR_UCI_MODEL_ROOT,revision,cacheDirectory:process.env.VECTOR_UCI_COMPILER_CACHE,knowledge}),record={schema:'vector_managed_knowledge_engine_observation_v1',...metadata,nodeVersion:process.versions.node,status:'pending',scope:'ready-advance-two-game-managed-KQ-root-only',timingQualified:false,fullDatasetQualified:false,bindingPath,appliedOptions:{RootTablebaseBinding:bindingPath,OwnBook:false}};
 try{
  await port.configure({name:'RootTablebaseBinding',value:bindingPath});await port.configure({name:'OwnBook',value:false});record.identity=await port.ready();
  const fen='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';record.initial=await port.admitPosition({fen,moves:[],rootEpoch:1});await delay(1200);await port.requestPublication({rootEpoch:1,requestId:1});const first=port.readPublication({rootEpoch:1,requestId:1});record.initialPublication=first;assert(first.action!==null&&first.legalProof.legal);
  let started=performance.now();record.successor=await port.admitPosition({fen,moves:[first.action],rootEpoch:2});record.successorMilliseconds=performance.now()-started;assert.equal(record.successor.observation.admission.route,'ready-advance');
  record.firstGameTeardown=await port.endGame();assertJoinedObservation(record.firstGameTeardown);
  const generation=statuses.filter(e=>e.provider==='root-tablebase'&&e.status.providerGeneration).at(-1)?.status.providerGeneration;assert(generation);
  await port.ready();await port.admitPosition({fen:'7k/8/5KQ1/8/8/8/8/8 w - - 0 1',moves:[],rootEpoch:3});
  record.rootContext=port.readRootKnowledgeContext();record.providerReadiness=actualProvider.describe();assert.equal(record.providerReadiness.status,'ready');assert.equal(record.providerReadiness.provider_identity.configuration_sha256,metadata.configuration.canonicalSha256);
  const action=uciToAction('g6g7');record.intent=await port.preparePublicationIntent({rootEpoch:3,requestId:3,searchmoves:[action]});
  // A tighter scope may initially have no compatible completed sample. Only
  // this qualification harness waits for the independently completed result;
  // the production publication request/read remains synchronous and bounded.
  started=performance.now();for(;;){const request=port.requestPublication({rootEpoch:3,requestId:3,searchmoves:[action]});assert.equal(typeof request?.then,'undefined');record.publication=port.readPublication({rootEpoch:3,requestId:3});if(record.publication?.knowledge?.authority==='tablebase-exact-root')break;if(performance.now()-started>5000)throw new Error('Managed exact root proof unavailable');await delay(10);}
  assert.equal(record.publication.action,action);assert.equal(record.publication.knowledge.providerGeneration,generation);assert.equal(record.publication.legalProof.legal,true);
  const selected=probes.find(p=>p.requestSha256===record.publication.knowledge.requestSha256);assert(selected,'Final publication must bind an actually issued public request');assert.equal(selected.providerGeneration,generation);assert.equal(selected.request.root_fence,record.rootContext.rootFence.map(w=>w.toString(16).padStart(8,'0')).join(''));assert.deepEqual(selected.request.searchmoves,['g6g7']);record.selectedRequest=selected;record.selectedAction=action;record.status='pass';
 }catch(error){record.status='fail';record.failure=error.message;throw error;}
 finally{try{record.teardown=await port.close();assertJoinedObservation(record.teardown);assertExternalObservation(record.teardown.knowledge,record.providerReadiness?.provider_generation??actualProvider?.describe().provider_generation);}catch(error){record.status='fail';record.closeFailure=error.message;throw error;}finally{record.statuses=statuses;record.probes=probes;await fs.writeFile(receiptPath,JSON.stringify(record,null,2)+'\n',{flag:'wx'});}}
});
