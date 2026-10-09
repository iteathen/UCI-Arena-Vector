import test from 'node:test';
import assert from 'node:assert/strict';
import {createReferee} from '../referee.mjs';
import {UciSession} from '../uci.mjs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const campaign=await import('../clock-experiment.mjs').catch(()=>({}));
test('live optional claims do not automatically end third repetition; fifth repetition does',()=>{
  const ref=createReferee(undefined,{rulesProfile:'orthodoxy-live-claims-v1'}),cycle=['g1f3','g8f6','f3g1','f6g8'];
  for(let round=0;round<2;round++)for(const move of cycle)ref.play(move);
  assert.equal(ref.terminal(),null);
  for(let round=0;round<2;round++)for(const move of cycle)ref.play(move);
  assert.deepEqual(ref.terminal(),{result:'1/2-1/2',termination:'fivefold_repetition'});
});
test('clock experiment keeps target focus current after both players including terminal move',async()=>{
  assert.equal(typeof campaign.playClockExperimentGame,'function');
  const positions={candidate:[],reference:[]};const session=(role,moves)=>({position:async(fen,history)=>positions[role].push([...history]),go:async()=>({move:moves.shift(),elapsed_ms:1,info:[]})});
  const result=await campaign.playClockExperimentGame({opening:{id:'fools',moves:[]},candidateColor:'white',initialTimeMs:180000,incrementMs:3000,maxPlies:16,responseTimeoutMs:1000,maxDurationMs:10000,referenceGo:{movetime:10}},session('candidate',['f2f3','g2g4']),session('reference',['e7e5','d8h4']));
  assert.equal(result.termination,'checkmate');assert.equal(result.complete,true);assert.equal(result.clocks_ms.white,185998);
  assert.deepEqual(positions.candidate.map(m=>m.length),[0,1,2,3,4]);assert.deepEqual(positions.reference.map(m=>m.length),[0,1,2,3,4]);
  assert.equal(result.records.length,4);assert.equal(result.rules_profile,'orthodoxy-live-claims-v1');
});
test('clock experiment reports genuine flag and bounds without claiming completed game',async()=>{
  const config={opening:{id:'start',moves:[]},candidateColor:'white',initialTimeMs:100,incrementMs:0,maxPlies:1,responseTimeoutMs:1000,maxDurationMs:10000,referenceGo:{movetime:10}};
  const session=elapsed=>({position:async()=>{},go:async()=>({move:'e2e4',elapsed_ms:elapsed,info:[]})});
  const flag=await campaign.playClockExperimentGame(config,session(101),session(1));assert.equal(flag.termination,'flag_fall');assert.equal(flag.complete,false);
  const bound=await campaign.playClockExperimentGame(config,session(1),session(1));assert.equal(bound.termination,'max_plies');assert.equal(bound.result,null);
});
test('live rule-75 is separate from optional rule-50 and checkmate has precedence',()=>{
  assert.equal(createReferee('7k/8/8/8/8/8/8/KR6 w - - 100 80',{rulesProfile:'orthodoxy-live-claims-v1'}).terminal(),null);
  assert.deepEqual(createReferee('7k/8/8/8/8/8/8/KR6 w - - 150 80',{rulesProfile:'orthodoxy-live-claims-v1'}).terminal(),{result:'1/2-1/2',termination:'rule_75'});
  assert.deepEqual(createReferee('7k/6Q1/5K2/8/8/8/8/8 b - - 150 80',{rulesProfile:'orthodoxy-live-claims-v1'}).terminal(),{result:'1-0',termination:'checkmate'});
});
test('independent UCI reference requires declared instrument identity and exact protocol name',async()=>{
  const script=fileURLToPath(new URL('./fixtures/uci.mjs',import.meta.url)),launch={executable:process.execPath,args:[script],cwd:path.dirname(script)};
  let invalid;try{assert.throws(()=>{invalid=new UciSession(launch,{},{expectedUciName:'protocol-fixture'});},/reference|identity/);}finally{if(invalid)await invalid.close();}
  const session=new UciSession(launch,{},{expectedUciName:'protocol-fixture',referenceInstrumentSha256:'a'.repeat(64)});
  try{const identity=await session.ready();assert.equal(identity.schema,'uci_reference_runtime_identity_v1');assert.equal(identity.id_name,'protocol-fixture');assert.equal(identity.instrument_sha256,'a'.repeat(64));}finally{await session.close();}
});
