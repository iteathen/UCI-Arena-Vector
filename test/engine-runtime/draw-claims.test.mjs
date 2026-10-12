import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {createRequire} from 'node:module';
import {admitPosition,actionToUci} from '../../components/chess-domain/admission.mjs';
const evaluatorLayout={requestInputPartition:{dtype:'f32',perRequestElements:1088,elementCount:1088,members:[{parameterName:'input0',offset:0,perItemElements:1088}]},resultOutputPartition:{dtype:'f32',perRequestElements:4163,elementCount:4163,members:[{parameterName:'output0',offset:0,perItemElements:4162},{parameterName:'output1',offset:4162,perItemElements:1}]},featureParameter:'input0',policyParameter:'output0',valueParameter:'output1'};
const require=createRequire(new URL('../../components/chess-domain/package.json',import.meta.url));
const {Chess}=require('chess.js');
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/V7zjDUiL-repetition.json',import.meta.url)));
const packed=uci=>{const sq=s=>(Number(s[1])-1)*8+s.charCodeAt(0)-97;return sq(uci.slice(0,2))|(sq(uci.slice(2,4))<<6)|(['','n','b','r','q'].indexOf(uci[4]??'')<<12);};
export function archivedClaimCase(plies,name,scalar,proofMode=0){
 const c=new Chess(fixture.originFen),history=[c.fen()];
 for(const uci of fixture.moves.slice(0,plies)){assert(c.move({from:uci.slice(0,2),to:uci.slice(2,4),...(uci[4]?{promotion:uci[4]}:{})}));history.push(c.fen());}
 const actions=c.moves({verbose:true}).map(m=>packed(m.from+m.to+(m.promotion??''))).sort((a,b)=>a-b);
 return{name,scalar,proofMode,state:admitPosition(c.fen(),{history}).words,actions};
}
test('archived exact history exposes the intended third occurrence before White Kb2',()=>{
 const c=new Chess(fixture.originFen),keys=[];keys.push(c.fen().split(' ').slice(0,4).join(' '));
 for(const uci of fixture.moves){c.move({from:uci.slice(0,2),to:uci.slice(2,4),...(uci[4]?{promotion:uci[4]}:{})});keys.push(c.fen().split(' ').slice(0,4).join(' '));}
 assert.deepEqual(keys.flatMap((k,i)=>k===keys.at(-1)?[i]:[]),fixture.expectedOccurrencePlies);
 assert.equal(actionToUci(packed('c2b2')),'c2b2');assert(archivedClaimCase(62,'before',-0.8).actions.includes(packed('c2b2')));
});
test('physical optional claim floor, mover perspective and actual claim-enabling selection',{skip:process.env.VECTOR_DRAW_CLAIM_NATIVE!=='1'},async()=>{
 const {qualifyDrawClaims}=await import('../../components/engine-runtime/draw-claim-qualification.mjs');
 const cases=[archivedClaimCase(62,'intended-losing',-0.8),archivedClaimCase(62,'intended-winning',0.8),archivedClaimCase(62,'intended-all-ordinary-loss',-0.8,2),archivedClaimCase(63,'current-losing',-0.8),archivedClaimCase(63,'current-winning',0.8),archivedClaimCase(62,'win-dominates-claim',0.8,1),archivedClaimCase(0,'no-claim',-0.8)];
 const child=archivedClaimCase(63,'opponent-winning-after-mover-claim',0.8);child.parentState=cases[0].state;child.incomingClaimMask=8;cases.push(child);
 const r=await qualifyDrawClaims(cases,evaluatorLayout),o=Object.fromEntries(r.observations.map(o=>[o.name,o]));
 for(const row of r.observations){assert.deepEqual(row.statuses,[0,0,0]);assert.equal(row.guardsPassed,true);}
 assert.equal(o['intended-losing'].claimMask,8);assert.equal(o['intended-losing'].cacheValue,0);assert.equal(o['intended-losing'].nodeSum,0);assert.equal(o['intended-winning'].cacheValue,Math.fround(0.8));
 assert.equal(o['current-losing'].claimMask,10);assert.equal(o['current-losing'].cacheValue,0);assert.equal(o['current-winning'].cacheValue,Math.fround(0.8));
 assert.equal(o['intended-all-ordinary-loss'].nodeProof,3);assert.equal(o['intended-all-ordinary-loss'].selectedAction,packed('c2b2'));assert.equal(o['intended-all-ordinary-loss'].encodedAction,packed('c2b2'));
 assert.equal(o['win-dominates-claim'].nodeProof,1);assert.equal(o['no-claim'].claimMask,0);assert.equal(o['no-claim'].cacheValue,Math.fround(-0.8));
 assert.equal(o['opponent-winning-after-mover-claim'].nodeSum,Math.fround(0.8));assert.equal(o['opponent-winning-after-mover-claim'].incomingSum,0);
 assert.equal(r.terminal.graceful,true);assert.equal(r.terminal.driver.resourceCounts.live,0);assert.equal(r.terminal.driver.resourceCounts.orphaned,0);
});
test('physical automatic threefold makes the actual repeating action draw even for positive winning NN value',{skip:process.env.VECTOR_DRAW_CLAIM_AUTO_NATIVE!=='1'},async()=>{
 const {qualifyDrawClaims}=await import('../../components/engine-runtime/draw-claim-qualification.mjs');
 const r=await qualifyDrawClaims([archivedClaimCase(62,'auto-winning',0.8,2),archivedClaimCase(62,'auto-winning-alternatives',0.8,3)],evaluatorLayout,{automaticThreefold:true}),o=r.observations[0];
 assert.deepEqual(o.statuses,[0,0,0]);assert.equal(o.guardsPassed,true);assert.equal(o.nodeProof,3);assert.equal(o.nodeSum,0);assert.equal(o.selectedAction,packed('c2b2'));assert.equal(o.encodedAction,packed('c2b2'));assert.equal(r.terminal.driver.resourceCounts.live,0);
 const winning=r.observations[1];assert.equal(winning.edges.find(e=>e.action===packed('c2b2')).proof,3);assert.equal(winning.nodeProof,1);assert.notEqual(winning.selectedAction,packed('c2b2'));assert.notEqual(winning.encodedAction,packed('c2b2'));
});
