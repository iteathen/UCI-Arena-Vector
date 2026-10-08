import assert from 'node:assert/strict';
import test from 'node:test';
import { createReferee } from '../referee.mjs';
import { playGame, runEvidence } from '../runtime.mjs';
import { UciSession } from '../uci.mjs';
import { validateLaunchArtifact, validateEngineIdentity } from '../artifact.mjs';
import { buildRuntimeContract } from '../contract.mjs';
import { executeRequest } from '../cli.mjs';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

test('independent referee checks exact UCI and special/terminal rules',()=>{
  const ref=createReferee();
  assert.throws(()=>ref.play('e2e5'),/illegal/);
  for(const move of ['f2f3','e7e5','g2g4','d8h4'])ref.play(move);
  assert.deepEqual(ref.terminal(),{result:'0-1',termination:'checkmate'});
  assert.throws(()=>ref.play('a2a3'),/terminal/);
  const promotion=createReferee('7k/P7/8/8/8/8/8/K7 w - - 0 1');
  promotion.play('a7a8q'); assert.match(promotion.fen(),/^Q/);
});
const fake = (moves,elapsed=1) => ({ready:async()=>{},position:async()=>{},go:async()=>({move:moves.shift(),elapsed_ms:elapsed,info:[]}),close:async()=>{}});
test('game clock charges elapsed then increment; only true terminal is complete',async()=>{
  const game=await playGame({opening:{id:'start',moves:[]},candidateColor:'white',initialTimeMs:100,incrementMs:2,maxPlies:10,responseTimeoutMs:1000},fake(['f2f3','g2g4']),fake(['e7e5','d8h4']));
  assert.equal(game.complete,true);assert.equal(game.result,'0-1');
  assert.equal(game.records.length,4); assert.equal(game.clocks_ms.white,102);
});
test('bounds, illegal moves and flag fall never claim complete legal game',async()=>{
  const opts={opening:{id:'start',moves:[]},candidateColor:'white',initialTimeMs:100,incrementMs:0,maxPlies:1,responseTimeoutMs:1000};
  assert.equal((await playGame(opts,fake(['e2e4']),fake([]))).complete,false);
  const illegal=await playGame(opts,fake(['e2e5']),fake([]));assert.equal(illegal.termination,'illegal_move');assert.equal(illegal.complete,false);
  const flag=await playGame(opts,fake(['e2e4'],101),fake([]));assert.equal(flag.termination,'flag_fall');assert.equal(flag.complete,false);
});
test('paired workload reverses candidate colors and preserves diagnostic authority',async()=>{
  let n=0;
  const output=await runEvidence({schema:'uci_arena_evidence_request_v2',request_id:'r',job_id:'j',shard_id:'s',workload:'paired_sprt',target_identity:{},runtime_identity:{},config:{openings:[{id:'mate',moves:['f2f3','e7e5','g2g4']}],initialTimeMs:1000,incrementMs:0,maxPlies:10,responseTimeoutMs:1000}}, {openSession:async()=>{n++;return fake(['d8h4']);}});
  assert.equal(n,4);assert.deepEqual(output.games.map(g=>g.candidate_color),['white','black']);
  assert.equal(output.status,'completed');assert.equal(output.qualification.strength,false);assert.equal(output.qualification.profile_publication,false);
});
test('public UCI subprocess handshake captures identity and bounded bestmove',async()=>{
  const script=fileURLToPath(new URL('fixtures/uci.mjs',import.meta.url));
  const session=new UciSession({executable:process.execPath,args:[script],cwd:path.dirname(script)},{});
  try {
    const identity=await session.ready({});assert.equal(identity.schema,'vector_engine_runtime_identity_v1');
    await session.position(undefined,[]);const reply=await session.go({movetime:5},1000);
    assert.equal(reply.move,'e2e4');assert.ok(reply.elapsed_ms>=0);
  }finally{await session.close();}
  assert.equal(session.closed,true);
});
test('public UCI rejects absent options and deadline loss closes owned process',async()=>{
  const script=fileURLToPath(new URL('fixtures/uci.mjs',import.meta.url));
  const session=new UciSession({executable:process.execPath,args:[script],cwd:path.dirname(script)},{Threads:4});
  await assert.rejects(session.ready({}),/undeclared UCI option/);await session.close();
  const silent=new UciSession({executable:process.execPath,args:[script,'silent'],cwd:path.dirname(script)},{});
  await silent.ready({});await silent.position(undefined,[]);
  await assert.rejects(silent.go({movetime:1},100),/timeout/);await silent.close();assert.equal(silent.closed,true);
});
test('process close awaits normal retirement and rejects abnormal exit',async()=>{
  const script=fileURLToPath(new URL('fixtures/uci.mjs',import.meta.url));
  const delayed=new UciSession({executable:process.execPath,args:[script,'delayed-quit'],cwd:path.dirname(script)},{});
  await delayed.ready();
  const [first,second]=await Promise.all([delayed.close(),delayed.close()]);
  assert.equal(first,second);assert.equal(first.normal_close,true);assert.equal(first.forced,false);
  assert.equal(first.exit_code,0);assert.equal(first.stdio_closed,true);
  const abnormal=new UciSession({executable:process.execPath,args:[script,'abnormal-quit'],cwd:path.dirname(script)},{});
  await abnormal.ready();await assert.rejects(abnormal.close(),/normal close/);
});
test('failed process retirement cannot produce a completed Evidence batch',async()=>{
  const session=fake(['e2e4']);session.close=async()=>{throw new Error('owned process normal close failed');};
  const output=await runEvidence({schema:'uci_arena_evidence_request_v2',request_id:'r',job_id:'j',shard_id:'s',workload:'timing_profile',target_identity:{},runtime_identity:{},config:{movetimesMs:[5],repetitions:1}}, {openSession:async()=>session});
  assert.equal(output.status,'failed');assert.equal(output.completed,false);
  assert.ok(output.failures.some(failure=>failure.includes('normal close')));
});
test('launch artifact validates profile and complete inventory, rejects byte drift',t=>{
  const root=mkdtempSync(path.join(os.tmpdir(),'vector-artifact-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const hash=b=>createHash('sha256').update(b).digest('hex');
  const expected={schema:'vector_engine_runtime_identity_v1',nodeVersion:'26.11.1',model:{modelId:'checkpoint',checkpointSha256:'a'.repeat(64),parametersSha256:'b'.repeat(64),constantsSha256:'c'.repeat(64)}};
  const profile={schema:'arena_uci_engine_launch_profile_v1',schema_version:1,component:{id:'uci_arena.vector',version:'0.1.0',root:'.'},engine:{adapter:'standard_uci_v1',executable:'bin/node.exe',arguments:['--experimental-ffi','dist/uci.mjs'],working_directory:'.'},enabled:true,state:'conservative',uci_options:{},expected_runtime:null};
  const files={'contracts/uci-engine-launch-profile.json':JSON.stringify(profile),'contracts/runtime-identity.json':JSON.stringify(expected),'bin/node.exe':'node fixture','dist/uci.mjs':'script fixture','models/default/params.bin':'model fixture'};
  const inventory=Object.entries(files).map(([name,data])=>{mkdirSync(path.dirname(path.join(root,name)),{recursive:true});writeFileSync(path.join(root,name),data);return{path:name,size_bytes:Buffer.byteLength(data),sha256:hash(data)};});
  const contract=buildRuntimeContract({componentVersion:'0.1.0',targetTriple:'windows-x86_64'});
  writeFileSync(path.join(root,'contracts/evidence-runtime-contract.json'),JSON.stringify(contract));
  inventory.push({path:'contracts/evidence-runtime-contract.json',size_bytes:Buffer.byteLength(JSON.stringify(contract)),sha256:hash(JSON.stringify(contract))});
  const manifest={schema:'arena_install_component_v1',schema_version:1,component_id:'uci_arena.vector',component_version:'0.1.0',target_triple:'windows-x86_64',capabilities:['evidence_runtime_contract_v2'],entrypoints:{evidence_runtime_contract:'contracts/evidence-runtime-contract.json'},files:inventory};
  writeFileSync(path.join(root,'arena-component.json'),JSON.stringify(manifest));
  const identity={component_id:'uci_arena.vector',component_version:'0.1.0',target_triple:'windows-x86_64',manifest_sha256:hash(JSON.stringify(manifest)),contract_sha256:hash(JSON.stringify(contract)),runtime_identity_sha256:hash(JSON.stringify(expected))};
  const runtime_binding={schema:'uci_arena_evidence_runtime_binding_v2',component:{id:'uci_arena.vector',version:'0.1.0',root,manifest:'arena-component.json',manifest_sha256:identity.manifest_sha256},entrypoint:'evidence_runtime_contract'};
  const launch={executable:path.join(root,'bin/node.exe'),arguments:['--experimental-ffi','dist/uci.mjs'],working_directory:root,uci_options:{}};
  const request={launch,runtime_binding,runtime_identity:identity,target_identity:{schema:'uci_arena_evidence_target_identity_v2',launch,engine_sha256:hash('node fixture')}};
  const artifact=validateLaunchArtifact(request);assert.deepEqual(artifact.launch.args,launch.arguments);
  const managed=structuredClone(request);
  managed.launch.arguments[1]=path.join(root,'dist/uci.mjs');
  managed.target_identity.launch=structuredClone(managed.launch);
  assert.deepEqual(validateLaunchArtifact(managed).launch.args,managed.launch.arguments);
  if(process.platform==='win32') {
    const alias=structuredClone(managed);
    alias.launch.executable=alias.launch.executable.toUpperCase();
    alias.launch.working_directory=alias.launch.working_directory.toUpperCase();
    alias.target_identity.launch=structuredClone(alias.launch);
    const admittedAlias=validateLaunchArtifact(alias).launch;
    assert.deepEqual(admittedAlias.args,alias.launch.arguments);
    assert.equal(admittedAlias.executable,alias.launch.executable);
    assert.equal(admittedAlias.cwd,alias.launch.working_directory);
  }
  const outside=structuredClone(managed);
  const external=path.join(path.dirname(root),`${path.basename(root)}-outside.mjs`);
  writeFileSync(external,'outside');t.after(()=>rmSync(external,{force:true}));
  outside.launch.arguments[1]=external;outside.target_identity.launch=structuredClone(outside.launch);
  assert.throws(()=>validateLaunchArtifact(outside),/launch/);
  writeFileSync(path.join(root,'models/default/params.bin'),'drift');assert.throws(()=>validateLaunchArtifact(request),/inventory/);
});
test('engine identity requires successful non-fixture actual model and cohort facts',()=>{
  const expected={schema:'vector_engine_runtime_identity_v1',nodeVersion:'26.11.1',model:{checkpointSha256:'a'.repeat(64)}};
  assert.throws(()=>validateEngineIdentity({...expected,fixture:true},expected),/fixture/);
  assert.throws(()=>validateEngineIdentity({...expected,model:{}},expected),/identity/);
  assert.doesNotThrow(()=>validateEngineIdentity(expected,expected));
  assert.throws(()=>validateEngineIdentity(expected,null),/expected/);
});
test('runtime contract advertises measurement capabilities without qualification claim',()=>{
  const contract=buildRuntimeContract({componentVersion:'0.1.0',targetTriple:'windows-x86_64',inventory:[{path:'contracts/runtime-identity.json',sha256:'a'.repeat(64)}]});
  assert.equal(contract.component_id,'uci_arena.vector');
  assert.deepEqual(Object.keys(contract.capabilities).sort(),['complete_game','paired_sprt','timing_profile']);
  assert.equal(contract.capabilities.complete_game.output_schema,'uci_arena_evidence_result_v2');
});
test('typed CLI rejects unsupported schema before opening an engine',async()=>{
  await assert.rejects(executeRequest({schema:'uci_arena_evidence_request_v99'}),/request/);
});
test('timing records preserve exact requested time and overshoot without policy authority',async()=>{
  const output=await runEvidence({schema:'uci_arena_evidence_request_v2',request_id:'r',job_id:'j',shard_id:'s',workload:'timing_profile',target_identity:{},runtime_identity:{},config:{openings:[{id:'start',moves:[]}],movetimesMs:[5],repetitions:2}}, {openSession:async()=>fake(['e2e4','d2d4'],7)});
  assert.equal(output.samples.length,2);assert.equal(output.samples[0].deadline_overshoot_ms,2);
  assert.equal(output.qualification.timing,false);assert.equal(output.status,'completed');
});
