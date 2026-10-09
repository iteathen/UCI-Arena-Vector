import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,writeFileSync,unlinkSync,rmdirSync} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createUciController} from '../../components/uci-protocol/index.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');
// Interface fixtures only. No declaration here is physical qualification or
// packaged producer output. Actual population evidence remains required.
function fixture(t){
  const dir=mkdtempSync(path.join(os.tmpdir(),'vector-policy-protocol-')),file=path.join(dir,'policy.json');
  let time=0,releaseAdmission;
  const output=[],requests=[],configures=[],timers=new Set(),snapshots=new Map();
  const identity={schema:'vector_engine_runtime_identity_v1',node:'v26.11.1'};
  const policy={schema:'vector_timing_policy_v1',producer:'vector-evidence-runtime/clock-allocation-v1',runtime_identity_sha256:sha(JSON.stringify(identity)),control:{initial_time_ms:180000,increment_ms:3000},strategy:{kind:'target_blocks_v1',target_blocks:1},useful_blocks_ms:[500],local_publication_reserve_ms:100,unsupported_fallback:'publish-current',qualification:{status:'qualified',study_sha256:sha('study'),discovery_sha256:sha('discovery'),held_out_sha256:sha('heldout'),reserve_sha256:sha('reserve'),allocation:true,useful_blocks:true,clock_safety:true,discovery:{opening_units:8,mean_score_gain:.25,directional_p:1/256},held_out:{opening_units:8,mean_score_gain:.25,directional_p:1/256}}};
  const text=JSON.stringify(policy);writeFileSync(file,text);
  const port={options:[{name:'OwnBook',type:'check',default:false,apply:'next-go'}],ready:async()=>identity,configure:async value=>configures.push(value),admitPosition:async({rootEpoch})=>{if(releaseAdmission)await releaseAdmission.promise;return{rootEpoch,sideToMove:0};},requestPublication:r=>requests.push(r),readPublication:r=>snapshots.get(r.requestId),close:async()=>({graceful:true})};
  const controller=createUciController({port,timingPolicySupport:true,write:row=>output.push(row),now:()=>time,setTimer:(fn,delay)=>{const timer={fn,at:time+delay};timers.add(timer);return timer;},clearTimer:timer=>timers.delete(timer)});
  t.after(async()=>{await controller.close();unlinkSync(file);rmdirSync(dir);});
  const advance=async ms=>{time+=ms;for(const timer of [...timers])if(timer.at<=time){timers.delete(timer);timer.fn();}for(let i=0;i<10;i++)await Promise.resolve();};
  const configure=async({initial=180000,overhead=50,digest=sha(text),ready=true}={})=>{for(const [name,value] of [['TimingPolicyFile',file],['TimingPolicySha256',digest],['TimingInitialTimeMs',initial],['Move Overhead',overhead]])await controller.handle(`setoption name ${name} value ${value}`);if(ready)await controller.handle('isready');};
  return{controller,port,output,requests,configures,timers,snapshots,file,text,configure,advance,defer(){let resolve;const promise=new Promise(r=>resolve=r);releaseAdmission={promise,resolve};return resolve;}};
}
test('timing options never enter search configuration or publication intent',async t=>{
  const f=fixture(t);let intent;f.port.preparePublicationIntent=async input=>{intent=input;return{bypassPublicationWait:false};};
  await f.configure();await f.controller.handle('position startpos');await f.controller.handle('go wtime 180000 btime 180000 winc 3000 binc 3000');
  assert.deepEqual(f.configures,[]);assert.deepEqual(intent.options,{OwnBook:false});await f.advance(500);assert.deepEqual(f.requests[0].options,{OwnBook:false});
});
test('policy readiness rejects incomplete bindings, changed bytes, wrong runtime and invalid UTF8',async t=>{
  for(const fault of ['partial','digest','identity','utf8']){
    const f=fixture(t);if(fault==='partial')await f.controller.handle(`setoption name TimingPolicyFile value ${f.file}`);else await f.configure({ready:false});
    if(fault==='digest')writeFileSync(f.file,f.text+' ');
    if(fault==='identity')f.port.ready=async()=>({schema:'vector_engine_runtime_identity_v1',node:'changed'});
    if(fault==='utf8')writeFileSync(f.file,Buffer.from([0xff,0xfe]));
    await assert.rejects(f.controller.handle('isready'));assert(!f.output.includes('readyok'));
  }
});
test('elapsed admission consumes clock envelope and cannot buy a partial block',async t=>{
  const f=fixture(t);await f.configure();const release=f.defer(),position=f.controller.handle('position startpos'),go=f.controller.handle('go wtime 800 btime 800 winc 3000 binc 3000');
  await f.advance(200);release();await position;await go;await f.advance(0);
  assert.equal(f.requests.length,1);const decision=JSON.parse(f.output.find(row=>row.startsWith('info string vector_timing_policy ')).slice('info string vector_timing_policy '.length));
  assert.deepEqual(decision.purchasedBlocksMs,[]);assert.equal(decision.safeEnvelopeFromGoMs,650);assert.equal(decision.publicationDeadlineFromGoMs,200);
});
test('unknown initial control publishes current with explicit unsupported authority',async t=>{
  const f=fixture(t);await f.configure({initial:0});await f.controller.handle('position startpos');await f.controller.handle('go wtime 180000 btime 180000 winc 3000 binc 3000');await f.advance(0);
  assert.equal(f.requests.length,1);const decision=JSON.parse(f.output.find(row=>row.startsWith('info string vector_timing_policy ')).slice('info string vector_timing_policy '.length));assert.equal(decision.usefulBlockAuthority,false);assert.equal(decision.reason,'unsupported_control_publish_current');
});
test('ponder waits for hit and qualified publication respects the explicit maximum',async t=>{
  const f=fixture(t);await f.configure();await f.controller.handle('position startpos');await f.controller.handle('go ponder wtime 180000 btime 180000 winc 3000 binc 3000 movetime 600');await f.advance(1000);assert.equal(f.requests.length,0);
  await f.controller.handle('ponderhit');await f.advance(0);assert.equal(f.requests.length,1);
});
test('next-go knowledge options cannot erase a ponder request timing authority',async t=>{
  const f=fixture(t);await f.configure();await f.controller.handle('position startpos');await f.controller.handle('go ponder wtime 180000 btime 180000 winc 3000 binc 3000');
  await f.controller.handle('setoption name OwnBook value true');await assert.doesNotReject(f.controller.handle('ponderhit'));await f.advance(499);assert.equal(f.requests.length,0);await f.advance(1);assert.equal(f.requests.length,1);assert.deepEqual(f.requests[0].options,{OwnBook:false});
});
test('latched policy survives a game while the next game readmits exact artifact bytes',async t=>{
  const f=fixture(t);await f.configure();await f.controller.handle('position startpos');await f.controller.handle('go ponder wtime 180000 btime 180000 winc 3000 binc 3000');writeFileSync(f.file,f.text+' ');
  await f.controller.handle('setoption name OwnBook value true');await f.controller.handle('isready');await f.controller.handle('ponderhit');await f.advance(500);assert.equal(f.requests.length,1);
  await f.controller.handle('ucinewgame');await assert.rejects(f.controller.handle('isready'),/digest/);
});
test('position cannot load a timing profile when between-game readiness was skipped',async t=>{
  const f=fixture(t);await f.configure({ready:false});writeFileSync(f.file,Buffer.from([0xff,0xfe]));
  let admissions=0,firstGame;f.port.admitPosition=async({rootEpoch,newGame})=>{admissions++;firstGame=newGame;return{rootEpoch,sideToMove:0};};
  await assert.rejects(f.controller.handle('position startpos'),/isready.*between games/);
  assert.equal(admissions,0);assert.equal(f.output.includes('readyok'),false);
  writeFileSync(f.file,f.text);await f.controller.handle('isready');
  await f.controller.handle('position startpos');assert.equal(admissions,1);assert.equal(firstGame,true);
});
test('failed position replacement cannot reopen timing-profile configuration inside a game',async t=>{
  const f=fixture(t);await f.configure();await f.controller.handle('position startpos');
  f.port.admitPosition=async()=>{throw new Error('replacement rejected');};
  await assert.rejects(f.controller.handle('position startpos moves e2e4'),/replacement rejected/);
  writeFileSync(f.file,f.text+' ');
  await assert.rejects(f.controller.handle('setoption name TimingPolicySha256 value '+sha('changed')),/game/);
  await assert.doesNotReject(f.controller.handle('isready'));
  await f.controller.handle('ucinewgame');await assert.rejects(f.controller.handle('isready'),/digest/);
});
test('queued rejected initial positions cannot consume the first actual game admission',async t=>{
  const f=fixture(t);await f.configure({ready:false});const admissions=[];
  f.port.admitPosition=async input=>{admissions.push(input);return{rootEpoch:input.rootEpoch,sideToMove:0};};
  const attempts=await Promise.allSettled([f.controller.handle('position startpos'),f.controller.handle('position startpos moves e2e4')]);
  assert(attempts.every(result=>result.status==='rejected'&&/isready.*between games/.test(result.reason.message)));assert.equal(admissions.length,0);
  await f.controller.handle('isready');await f.controller.handle('position startpos');assert.equal(admissions.length,1);assert.equal(admissions[0].newGame,true);
});
