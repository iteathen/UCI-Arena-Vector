import {createHash} from 'node:crypto';
import {Chess} from 'chess.js';
import {validateOwnerTeardown} from './teardown.mjs';
import {admitOperationalExperiment} from '../move-timing/operational-experiment.mjs';
import {admitOperationalTimingPolicy} from '../move-timing/operational-policy.mjs';
import {createReferee} from './referee.mjs';
import {assertClockRuntimeRules} from './clock-study.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex'),hex=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const fail=message=>{throw new Error('operational clock execution: '+message);};
function artifact(value){if(typeof value?.text!=='string'||Buffer.byteLength(value.text)>16777216||!hex(value.sha256)||sha(value.text)!==value.sha256)fail('receipt digest or extent');return JSON.parse(value.text);}
function finite(value,min,max){if(!Number.isFinite(value)||value<min||value>max)fail('measurement bounds');return value;}
function ns(value){if(typeof value!=='string'||!/^(0|[1-9][0-9]{0,19})$/.test(value))fail('nanosecond observation');const n=BigInt(value);if(n>0xffffffffffffffffn)fail('nanosecond extent');return n;}
function nativeMarkers(value){if(!value||typeof value!=='object')return;if(value.fixture===true||value.includes_fixture===true||value.evidence_class==='fixture')fail('nested fixture evidence');for(const child of Object.values(value))nativeMarkers(child);}
function receiveClock(response){const c=response.clock_observation;if(c?.schema!=='vector_uci_receive_clock_v1')fail('literal receive clock');const command=ns(c.command_sent_ns),received=ns(c.bestmove_received_ns);if(received<command||response.elapsed_ms!==Number(received-command)/1e6)fail('actual receive charge');return {command,received,emitReceived:c.emit_received_ns===undefined?null:ns(c.emit_received_ns)};}
function normalClose(value,joined){
  if(value?.schema!=='vector_uci_process_close_observation_v1'||value.normal_close!==true||value.forced!==false||value.exit_code!==0||value.signal!==null||value.stdio_closed!==true)fail('normal process closure');
  if(joined){if(value.owner_teardown_status!=='validated')fail('owner closure');const owner=validateOwnerTeardown(value.owner_teardown,{requireJoined:true});for(const row of [owner,...(owner.gameTeardowns??[])])if(row.joined&&(row.semantic.fields.drainDisposition!==0||row.semantic.fields.stopCause!==2))fail('first-stop/drain closure');}
}
function lines(response,prefix){if(!Array.isArray(response?.info)||response.info.length>256||response.info.some(v=>typeof v!=='string'||v.length>32768))fail('response extent');return response.info.filter(v=>v.startsWith(prefix)).map(v=>{const result=JSON.parse(v.slice(prefix.length));nativeMarkers(result);return result;});}
function checkCase(row,experiment){
  if(typeof row.fen!=='string'||row.fen.length>128||!Number.isSafeInteger(row.remaining_ms)||row.remaining_ms<0||row.remaining_ms>0xfffffffe||!Number.isSafeInteger(row.increment_ms)||row.increment_ms<0||row.increment_ms>60000||row.explicit_limit_ms!==null&&(!Number.isSafeInteger(row.explicit_limit_ms)||row.explicit_limit_ms<0||row.explicit_limit_ms>0xfffffffe))fail('actual input bounds');
  const response=row.response,decisions=lines(response,'info string vector_timing_experiment '),phases=lines(response,'info string vector_clock_phase ');
  const measured=receiveClock(response);
  if(decisions.length===0){const legal=new Chess(row.fen).moves({verbose:true});if(legal.length===1&&legal[0].from+legal[0].to+(legal[0].promotion??'')===response.move)return null;}
  if(decisions.length!==1)fail('one actual allocation decision');const d=decisions[0];
  if(d.schema!=='vector_timing_experiment_decision_v1'||d.diagnostic!==true||d.experiment_sha256!==experiment.sha256||d.qualificationScope!=='diagnostic_clock_execution'||d.usefulBlockAuthority!==false||d.operationalBudgetAuthority!==false||d.purchasedBlocksMs?.length!==0)fail('diagnostic authority');
  if(d.clock?.initialTimeMs!==180000||d.clock.remainingMs!==row.remaining_ms||d.clock.incrementMs!==row.increment_ms||d.clock.movesToGo!==null||d.localPublicationReserveMs!==experiment.local_publication_reserve_ms||!Number.isSafeInteger(d.transportReserveMs)||d.transportReserveMs<0||d.transportReserveMs>60000)fail('actual clock binding');
  const phase=name=>{const found=phases.filter(v=>v.phase===name&&v.rootEpoch===d.focusIdentity?.rootEpoch&&v.requestId===d.focusIdentity?.requestId);if(found.length!==1||found[0].schema!=='vector_uci_clock_phase_v1')fail('actual focus/phase');return found[0];};
  const go=phase('goReceived'),allocated=phase('experimentalAllocation'),requested=phase('publicationRequested'),emitted=phase('emit');
  finite(go.time,0,Number.MAX_SAFE_INTEGER);finite(allocated.time,go.time,Number.MAX_SAFE_INTEGER);finite(requested.time,allocated.time,Number.MAX_SAFE_INTEGER);finite(emitted.time,requested.time,Number.MAX_SAFE_INTEGER);
  const goNs=ns(go.monotonicNanoseconds),allocatedNs=ns(allocated.monotonicNanoseconds),requestedNs=ns(requested.monotonicNanoseconds),emittedNs=ns(emitted.monotonicNanoseconds);
  if(goNs<measured.command||allocatedNs<goNs||requestedNs<allocatedNs||emittedNs<requestedNs||measured.received<requestedNs||measured.emitReceived===null||measured.emitReceived<emittedNs||measured.emitReceived<measured.received)fail('actual receive/phase ordering');
  for(const [phase,observed] of [[allocated,allocatedNs],[requested,requestedNs],[emitted,emittedNs]])if(Math.abs((phase.time-go.time)-Number(observed-goNs)/1e6)>1)fail('literal native phase duration');
  const reserve=d.localPublicationReserveMs+d.transportReserveMs,safe=Math.max(0,Math.min(row.remaining_ms,row.explicit_limit_ms??row.remaining_ms)-reserve);
  if(d.safeEnvelopeFromGoMs!==safe)fail('hard envelope');
  if(row.increment_ms===0&&row.remaining_ms<=180000){
    const nominal=Math.min(safe,Math.floor(Math.max(0,row.remaining_ms-reserve)/experiment.strategy.future_decisions));
    if(d.publicationDeadlineFromGoMs<nominal||d.publicationDeadlineFromGoMs>Math.max(nominal,allocated.time-go.time))fail('clock-share/elapsed accounting');
    if(requested.time<go.time+d.publicationDeadlineFromGoMs||emitted.time>requested.time+experiment.local_publication_reserve_ms||emitted.time-go.time>Math.max(0,row.remaining_ms-d.transportReserveMs))fail('actual supported deadline/clock safety');
  }else if(d.reason!=='unsupported_control_publish_current'||d.publicationDeadlineFromGoMs!==0)fail('unsupported control authority');
  const board=new Chess(row.fen);if(!board.moves({verbose:true}).some(v=>v.from+v.to+(v.promotion??'')===response.move))fail('actual legal move');
  return d;
}

// Actual source/native records authorize execution only. This producer cannot
// promote a fixture, reuse a v1 population report, or infer strength/optimality.
export function produceOperationalTimingPolicy(value){
  const r=artifact(value);
  nativeMarkers(r);
  if(r.schema!=='vector_operational_clock_execution_v1'||r.evidence_class!=='native'||r.fixture!==false||!/^[a-f0-9]{40}$/.test(r.source_commit??'')||r.runtime_identity?.vectorRevision!==r.source_commit||r.runtime_identity?.nodeVersion!=='26.11.1'||r.node_executable_sha256!=='a619e2e09eb0d50ef4c733d678b4d22689d2afef138cd67fd3fa107b535f8819')fail('native receipt identity');
  const identity=sha(JSON.stringify(r.runtime_identity));if(r.runtime_identity_sha256!==identity||r.hardware_identity_sha256!==sha(JSON.stringify({device:r.runtime_identity.device,lowerProfile:r.runtime_identity.lowerProfile})))fail('native runtime/hardware binding');
  const experiment=admitOperationalExperiment(r.experiment?.text,{sha256:r.experiment?.sha256,runtimeIdentitySha256:identity});
  assertClockRuntimeRules(r.runtime_identity,experiment.rules_profile);
  const closures=new Map();if(!Array.isArray(r.closures)||r.closures.length<1||r.closures.length>64)fail('closure extent');
  for(const row of r.closures){if(typeof row.id!=='string'||closures.has(row.id))fail('closure identity');normalClose(row.observation,row.owner===true);closures.set(row.id,row);}
  const seen=new Set(),literal=new Set(),partitionProcesses=new Set();
  for(const partition of ['calibration','held_out']){
    const rows=r.reserve?.[partition];if(!Array.isArray(rows)||rows.length<30||rows.length>4096)fail('independent reserve population');
    const processes=new Set();for(const row of rows){if(!Number.isSafeInteger(row.root_epoch)||row.root_epoch<1||!Number.isSafeInteger(row.request_id)||row.request_id<1||partitionProcesses.has(row.process_id))fail('reserve request identity/partition');processes.add(row.process_id);const key=`${row.process_id}/${row.root_epoch}/${row.request_id}`;if(seen.has(key)||closures.get(row.process_id)?.owner!==true)fail('reserve request/closure identity');seen.add(key);
      const requested=ns(row.publication_requested_ns),emitted=ns(row.emitted_ns),received=ns(row.received_ns);
      const observation=`${requested}/${emitted}/${received}`;if(literal.has(observation))fail('replayed literal reserve observation');literal.add(observation);
      if(emitted<requested||received<emitted||received-requested>BigInt(experiment.local_publication_reserve_ms)*1000000n)fail('literal native reserve bound');
      const decision=checkCase(row,experiment),phases=lines(row.response,'info string vector_clock_phase ');if(!decision||decision.focusIdentity.rootEpoch!==row.root_epoch||decision.focusIdentity.requestId!==row.request_id||phases.find(v=>v.phase==='publicationRequested')?.monotonicNanoseconds!==row.publication_requested_ns||phases.find(v=>v.phase==='emit')?.monotonicNanoseconds!==row.emitted_ns||row.response.clock_observation.emit_received_ns!==row.received_ns)fail('reserve actual response mapping');
    }
    for(const id of processes)partitionProcesses.add(id);
  }
  if(!Array.isArray(r.cases)||r.cases.length<6||r.cases.length>128)fail('native allocation cases');
  const operative=[];for(const row of r.cases){if(closures.get(row.process_id)?.owner!==true)fail('case owner closure');if(checkCase(row,experiment))operative.push(row);}
  for(const remaining of [180000,30000,6000])if(!operative.some(v=>v.remaining_ms===remaining&&v.increment_ms===0&&v.explicit_limit_ms===null))fail('operative high/mid/low clock coverage');
  if(!operative.some(v=>v.increment_ms===1)||!operative.some(v=>v.explicit_limit_ms!==null)||!operative.some(v=>v.remaining_ms>180000))fail('operative unsupported/explicit coverage');
  if(!Array.isArray(r.games)||r.games.length<2||r.games.length>16)fail('complete native games');
  const colors=new Set();for(const trial of r.games){const g=trial.game;
    if(closures.get(trial.candidate_process_id)?.owner!==true||!closures.has(trial.reference_process_id)||g?.schema!=='vector_clock_experiment_game_v1'||g.complete!==true||g.legal!==true||g.failure!==null||!Array.isArray(g.records)||g.records.length<16||g.records.length>512||g.rules_profile!==experiment.rules_profile||g.trial_controls?.initialTimeMs!==180000||g.trial_controls?.incrementMs!==0)fail('native complete game');
    colors.add(g.candidate_color);const ref=createReferee(g.trial_controls.opening.fen,{rulesProfile:g.rules_profile});g.trial_controls.opening.moves.forEach(move=>ref.play(move));const clocks={white:180000,black:180000};
    if(g.diagnostic!==true||!g.qualification||Object.keys(g.qualification).sort().join(',')!=='publication,strength,timing,useful_blocks'||Object.values(g.qualification).some(v=>v!==false)||g.trial_controls.rulesProfile!==experiment.rules_profile||g.trial_controls.candidateColor!==g.candidate_color||!['white','black'].includes(g.candidate_color))fail('diagnostic game qualification/rule controls');
    for(const [index,row] of g.records.entries()){const color=ref.turn()==='w'?'white':'black';if(ref.terminal()||row.ply!==g.trial_controls.opening.moves.length+index||row.color!==color||row.owner!==(color===g.candidate_color?'candidate':'reference')||row.fen!==ref.fen()||row.clock_before_ms?.white!==clocks.white||row.clock_before_ms?.black!==clocks.black)fail('independent game replay');finite(row.elapsed_ms,0,300000);receiveClock(row);clocks[color]-=row.elapsed_ms;if(clocks[color]<=0)fail('native flag');if(row.owner==='candidate')checkCase({fen:row.fen,remaining_ms:Math.floor(row.clock_before_ms[color]),increment_ms:0,explicit_limit_ms:null,response:row},experiment);ref.play(row.move);if(row.clock_after_ms?.white!==clocks.white||row.clock_after_ms?.black!==clocks.black)fail('actual game recurrence');}
    const end=ref.terminal();if(!end||end.result!==g.result||end.termination!==g.termination||ref.fen()!==g.final_fen||g.clocks_ms?.white!==clocks.white||g.clocks_ms?.black!==clocks.black)fail('actual terminal result');
  }
  if(!colors.has('white')||!colors.has('black'))fail('both native candidate colors');
  const reserveSha=sha(JSON.stringify(r.reserve));
  const policy={schema:'vector_operational_timing_policy_v1',producer:'vector-evidence-runtime/operational-clock-budget-v1',runtime_identity_sha256:identity,control:experiment.supported_inputs,strategy:experiment.strategy,local_publication_reserve_ms:experiment.local_publication_reserve_ms,unsupported_fallback:'publish-current',qualification:{status:'qualified-for-declared-execution',scope:'native_clock_execution',evidence_class:'native',receipt_sha256:value.sha256,reserve_sha256:reserveSha,allocation_execution:true,clock_safety:true,useful_blocks:false,strength:false,optimality:false}};
  const text=JSON.stringify(policy)+'\n',sha256=sha(text);admitOperationalTimingPolicy(text,{sha256,runtimeIdentitySha256:identity});
  return Object.freeze({text,sha256,receipt_sha256:value.sha256,reserve_sha256:reserveSha,qualification_scope:'native_clock_execution'});
}
