import assert from 'node:assert/strict';
import test from 'node:test';
import {createTablebaseCoordinator} from '../../components/root-knowledge/tablebase-coordinator.mjs';
import {createRootKnowledgeCoordinator} from '../../components/root-knowledge/coordinator.mjs';

const context=()=>({schema:'vector_root_knowledge_context_v1',claimPolicy:'orthodoxy-live-claims-v1',rootEpoch:1,rootFence:[1,2,3,4],input:{originFen:'8/8/8/8/8/2k5/8/KQ6 w - - 0 1',moves:[]},legalActions:[576,577,1153],terminal:false});
function fixture(){
 let state='ready',probes=0,abandoned=0,closed=0;
 const accepted=Object.freeze({status:'safety-only',actions:Object.freeze([576,577]),requestSha256:'a'.repeat(64),providerGeneration:'b'.repeat(32),failureDisposition:'provider-failed-after-raw'});
 const provider={describe:()=>({status:state,provider_generation:'b'.repeat(32),provider_identity:{dataset:{admitted_cardinality:3}}}),probe(){probes++;return {read:()=>accepted,abandon(){abandoned++;}};},async close(){closed++;return {provider:{status:'closed',drained:true,failed:state!=='ready'},process:{code:state==='ready'?0:1,signal:null,forced:false},stderr:''};}};
 const statuses=[],coordinator=createTablebaseCoordinator({loadBinding:async()=>({}),openProvider:async()=>provider,onStatus:row=>statuses.push(row)});
 return {coordinator,provider,accepted,statuses,setFailed(){state='failed';},counts:()=>({probes,abandoned,closed})};
}

test('same admitted scope retains accepted raw safety and source identity across provider failure and new frontend request',async()=>{
 const f=fixture(),c=f.coordinator,root=context();c.configure('C:/managed/binding.json');await c.ready();c.onPosition(root,true);
 const first=c.prepare({context:root,requestId:1,searchmoves:[],enabled:true});assert.equal(first.applicable,true);assert.deepEqual(first.result.actions,[576,577]);f.setFailed();
 const next=c.prepare({context:structuredClone(root),requestId:2,searchmoves:[],enabled:true});assert.equal(next.applicable,true);assert.deepEqual(next.result,first.result);assert.deepEqual(c.publication({context:root,requestId:2}),first.result);assert.equal(c.publication({context:root,requestId:1}),null);
 assert.equal(next.result.requestSha256,f.accepted.requestSha256);assert.equal(next.result.providerGeneration,f.accepted.providerGeneration);assert.equal(next.result.failureDisposition,'provider-failed-after-raw');assert.equal(f.provider.describe().status,'failed');assert.equal(f.counts().probes,1);assert.equal(f.counts().abandoned,0);assert.equal(f.statuses.filter(s=>s.status.state==='ready').length,1);
 const close=await c.close();assert.equal(close.provider.failed,true);assert.equal(close.process.code,1);assert.equal(f.counts().closed,1);
});

test('changed fence history legal set restrictions or disabled policy retires the old safety instead of relabeling it',async()=>{
 const variants=[{context:r=>({...r,rootFence:[1,2,3,5]})},{context:r=>({...r,input:{...r.input,moves:[577]}})},{context:r=>({...r,legalActions:[577,1153]})},{context:r=>({...r,claimPolicy:'different-policy'})},{searchmoves:[577]},{enabled:false}];
 for(const variant of variants){const f=fixture(),c=f.coordinator,root=context();c.configure('C:/managed/binding.json');await c.ready();c.prepare({context:root,requestId:1,searchmoves:[],enabled:true});f.setFailed();const changed=variant.context?variant.context(root):root,result=c.prepare({context:changed,requestId:2,searchmoves:variant.searchmoves??[],enabled:variant.enabled??true});assert.equal(result.applicable,false);assert.equal(result.result,null);assert.equal(c.publication({context:changed,requestId:2}),null);assert.equal(f.counts().abandoned,1);assert.equal(f.counts().probes,1);await c.close();}
});

test('admitted configuration cannot change under retained safety and an explicit new game retires the ticket',async()=>{
 const f=fixture(),c=f.coordinator,root=context();c.configure('C:/managed/binding.json');await c.ready();const original=c.prepare({context:root,requestId:1,searchmoves:[],enabled:true});assert.throws(()=>c.configure('C:/other/binding.json'),/restart/);assert.deepEqual(c.publication({context:root,requestId:1}),original.result);c.endGame();assert.equal(c.publication({context:root,requestId:1}),null);assert.equal(f.counts().abandoned,1);await c.close();
});

test('whole root-knowledge admission cannot fall back to Book after failed provider with completed same-scope safety',async()=>{
 let state='ready',bookRolls=0,probes=0,abandoned=0;
 const accepted={status:'safety-only',actions:[577],requestSha256:'a'.repeat(64),providerGeneration:'b'.repeat(32),failureDisposition:'provider-failed-after-raw'},provider={describe:()=>({status:state,provider_identity:{dataset:{admitted_cardinality:3}}}),probe(){probes++;return {read:()=>accepted,abandon(){abandoned++;}};},async close(){return {provider:{status:'closed',drained:true,failed:true},process:{code:1,signal:null,forced:false},stderr:''};}};
 const bookProvider={async reload(){return {active:true,snapshot:{identity:'a'}};},beginGame(){return {resolve(){bookRolls++;return {status:'unavailable'};},close(){}};},async refreshGame(){}};
 const c=createRootKnowledgeCoordinator({bookProvider,environment:{},loadTablebaseBinding:async()=>({}),openTablebaseProvider:async()=>provider}),root=context();await c.configure({name:'RootTablebaseBinding',value:'C:/managed/binding.json'});await c.ready();await c.beginGame();await c.onPosition(root);
 const first=await c.prepare({context:root,requestId:1});assert.equal(first.authority,'tablebase-raw-wdl-root');state='failed';const next=await c.prepare({context:structuredClone(root),requestId:2});assert.equal(next.status,'constrained');assert.deepEqual(next.actions,[577]);assert.equal(next.requestSha256,first.requestSha256);assert.equal(next.providerGeneration,first.providerGeneration);assert.equal(bookRolls,0);assert.equal(probes,1);assert.equal(abandoned,0);assert.deepEqual(c.publication({context:root,requestId:2}),next);await c.close();
});
