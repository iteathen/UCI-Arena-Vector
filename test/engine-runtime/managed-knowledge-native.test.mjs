import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createGameSearchPort} from '../../components/engine-runtime/game-search-port.mjs';
import {canonicalJson} from '../../components/root-knowledge/tablebase.mjs';
import {uciToAction} from '../../components/uci-protocol/index.mjs';
import selection from '../../contracts/root-tablebase-selection.json' with {type:'json'};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const sha=b=>createHash('sha256').update(b).digest('hex');

test('actual public engine keeps managed provider across games and consumes exact root proof through final GPU output',{skip:process.env.VECTOR_MANAGED_KNOWLEDGE_NATIVE!=='1'},async()=>{
 const revision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),bindingPath=process.env.VECTOR_TB_BINDING_OUTPUT,receiptPath=process.env.VECTOR_MANAGED_KNOWLEDGE_RECEIPT;
 assert(bindingPath&&receiptPath&&process.env.VECTOR_TB_PACKAGE_ROOT&&process.env.VECTOR_TB_CONFIG);
 const binding={schema:'vector_root_tablebase_binding_v1',selectionSha256:sha(canonicalJson(selection)),componentRoot:process.env.VECTOR_TB_PACKAGE_ROOT,configuration:{path:process.env.VECTOR_TB_CONFIG,sha256:sha(await fs.readFile(process.env.VECTOR_TB_CONFIG))}};
 await fs.writeFile(bindingPath,JSON.stringify(binding,null,2)+'\n',{flag:'wx'});
 const statuses=[],port=createGameSearchPort({modelRoot:process.env.VECTOR_UCI_MODEL_ROOT,revision,cacheDirectory:process.env.VECTOR_UCI_COMPILER_CACHE,onKnowledgeStatus:e=>statuses.push(e)}),record={schema:'vector_managed_knowledge_engine_observation_v1',sourceRevision:revision,nodeVersion:process.versions.node,status:'pending',scope:'ready-advance-two-game-managed-KQ-root-only',timingQualified:false,fullDatasetQualified:false};
 try{
  await port.configure({name:'RootTablebaseBinding',value:bindingPath});record.identity=await port.ready();
  const fen='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';record.initial=await port.admitPosition({fen,moves:[],rootEpoch:1});await delay(1200);await port.requestPublication({rootEpoch:1,requestId:1});const first=port.readPublication({rootEpoch:1,requestId:1});record.initialPublication=first;assert(first.action!==null&&first.legalProof.legal);
  let started=performance.now();record.successor=await port.admitPosition({fen,moves:[first.action],rootEpoch:2});record.successorMilliseconds=performance.now()-started;assert.equal(record.successor.observation.admission.route,'ready-advance');
  record.firstGameTeardown=await port.endGame();assert.equal(record.firstGameTeardown.joined,true);
  const generation=statuses.filter(e=>e.provider==='root-tablebase'&&e.status.providerGeneration).at(-1)?.status.providerGeneration;assert(generation);
  await port.ready();await port.admitPosition({fen:'7k/8/5KQ1/8/8/8/8/8 w - - 0 1',moves:[],rootEpoch:3});
  const action=uciToAction('g6g7');record.intent=await port.preparePublicationIntent({rootEpoch:3,requestId:3,searchmoves:[action]});
  started=performance.now();for(;;){await port.requestPublication({rootEpoch:3,requestId:3,searchmoves:[action]});record.publication=port.readPublication({rootEpoch:3,requestId:3});if(record.publication.knowledge?.authority==='tablebase-exact-root')break;if(performance.now()-started>5000)throw new Error('Managed exact root proof unavailable');await delay(10);}
  assert.equal(record.publication.action,action);assert.equal(record.publication.knowledge.providerGeneration,generation);assert.equal(record.publication.legalProof.legal,true);record.status='pass';
 }catch(error){record.status='fail';record.failure=error.message;throw error;}
 finally{try{record.teardown=await port.close();assert.equal(record.teardown.cleanup.runtime.driver.resourceCounts.live,0);assert.equal(record.teardown.cleanup.runtime.driver.resourceCounts.orphaned,0);assert.equal(record.teardown.knowledge.provider.drained,true);assert.equal(record.teardown.knowledge.provider.failed,false);assert.equal(record.teardown.knowledge.process.code,0);assert.equal(record.teardown.knowledge.process.forced,false);}catch(error){record.status='fail';record.closeFailure=error.message;throw error;}finally{record.statuses=statuses;await fs.writeFile(receiptPath,JSON.stringify(record,null,2)+'\n',{flag:'wx'});}}
});
