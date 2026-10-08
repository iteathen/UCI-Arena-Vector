import { createReferee } from './referee.mjs';

function integer(value,fallback,min,max,label) {
  const n=value??fallback;
  if(!Number.isSafeInteger(n)||n<min||n>max)throw new Error(`${label} is outside ${min}..${max}`);
  return n;
}
export function validateConfig(value={}) {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('configuration must be an object');
  const keys=new Set(['campaign','openings','initialTimeMs','incrementMs','maxPlies','responseTimeoutMs','maxDurationMs','repetitions','movetimesMs','candidateOptions','controlOptions']);
  if(Object.keys(value).some(key=>!keys.has(key)))throw new Error('unknown measurement configuration field');
  const openings=value.openings??[{id:'start',moves:[]}];
  if(!Array.isArray(openings)||openings.length<1||openings.length>128)throw new Error('openings must contain 1..128 records');
  for(const opening of openings) {
    if(!opening||typeof opening.id!=='string'||!opening.id.length||opening.id.length>256
      ||(opening.fen!==undefined&&(typeof opening.fen!=='string'||opening.fen.length>256))
      ||!Array.isArray(opening.moves)||opening.moves.length>1024)throw new Error('invalid opening');
    const ref=createReferee(opening.fen);for(const move of opening.moves)ref.play(move);
  }
  const movetimes=value.movetimesMs??[100,500,1000];
  if(!Array.isArray(movetimes)||movetimes.length<1||movetimes.length>64)throw new Error('invalid movetimes');
  movetimes.forEach(n=>integer(n,undefined,1,60000,'movetime'));
  return {openings,initialTimeMs:integer(value.initialTimeMs,60000,1,3600000,'initialTimeMs'),
    incrementMs:integer(value.incrementMs,0,0,60000,'incrementMs'),maxPlies:integer(value.maxPlies,512,1,2048,'maxPlies'),
    responseTimeoutMs:integer(value.responseTimeoutMs,30000,100,300000,'responseTimeoutMs'),
    maxDurationMs:integer(value.maxDurationMs,300000,1000,3600000,'maxDurationMs'),
    repetitions:integer(value.repetitions,1,1,100,'repetitions'),movetimesMs:movetimes};
}
export async function playGame(config,candidate,control) {
  const ref=createReferee(config.opening.fen);
  const moves=[...config.opening.moves];for(const move of moves)ref.play(move);
  const clocks={white:config.initialTimeMs,black:config.initialTimeMs};const records=[];
  let outcome=ref.terminal();let failure=null;
  for(let ply=0;!outcome&&ply<config.maxPlies;ply++) {
    const color=ref.turn()==='w'?'white':'black';const owner=color===config.candidateColor?'candidate':'control';
    const session=owner==='candidate'?candidate:control;
    const before=ref.fen(); const prior={...clocks};
    try {
      await session.position(config.opening.fen,moves);
      const reply=await session.go({wtime:Math.max(1,Math.floor(clocks.white)),btime:Math.max(1,Math.floor(clocks.black)),winc:config.incrementMs,binc:config.incrementMs},config.responseTimeoutMs);
      if(!Number.isFinite(reply.elapsed_ms)||reply.elapsed_ms<0)throw new Error('invalid elapsed measurement');
      clocks[color]-=reply.elapsed_ms;
      const record={ply:moves.length,owner,color,fen:before,move:reply.move,elapsed_ms:reply.elapsed_ms,clock_before_ms:prior,info:reply.info??[]};
      records.push(record);
      if(clocks[color]<=0) {outcome={result:color==='white'?'0-1':'1-0',termination:'flag_fall'};break;}
      try {ref.play(reply.move);}catch {outcome={result:null,termination:'illegal_move'};failure='engine returned illegal move';break;}
      clocks[color]+=config.incrementMs;record.clock_after_ms={...clocks};moves.push(reply.move);outcome=ref.terminal();
    } catch(error) {outcome={result:null,termination:'engine_failure'};failure=String(error.message).slice(0,2048);}
  }
  outcome??={result:null,termination:'max_plies'};
  return {opening_id:config.opening.id,candidate_color:config.candidateColor,...outcome,
    complete:!['max_plies','flag_fall','illegal_move','engine_failure'].includes(outcome.termination),
    legal:!['illegal_move','engine_failure'].includes(outcome.termination),records,clocks_ms:clocks,
    final_fen:ref.fen(),pgn:ref.pgn(),failure};
}
export async function runEvidence(request,{openSession}) {
  if(request?.schema!=='uci_arena_evidence_request_v2'||!['complete_game','paired_sprt','timing_profile'].includes(request.workload))throw new Error('unsupported evidence request');
  const config=validateConfig(request.config);const games=[];const samples=[];const failures=[];
  const sessions=new Set();const identities=[];
  const open=async(role)=>{const session=await openSession(role,request);sessions.add(session);const identity=await session.ready(request);if(identity)identities.push({role,identity});return session;};
  try {
    if(request.workload==='timing_profile') {
      const session=await open('candidate');
      for(const opening of config.openings)for(const movetime of config.movetimesMs)for(let repetition=0;repetition<config.repetitions;repetition++) {
        const ref=createReferee(opening.fen);for(const move of opening.moves)ref.play(move);
        if(ref.terminal())throw new Error('timing opening is terminal');
        await session.position(opening.fen,opening.moves);
        const reply=await session.go({movetime},config.responseTimeoutMs);
        ref.play(reply.move);
        samples.push({opening_id:opening.id,fen:opening.fen??'startpos',moves:opening.moves,repetition,requested_ms:movetime,
          elapsed_ms:reply.elapsed_ms,deadline_overshoot_ms:Math.max(0,reply.elapsed_ms-movetime),move:reply.move,legal:true,info:reply.info??[]});
      }
    } else {
      for(const opening of config.openings)for(const candidateColor of request.workload==='paired_sprt'?['white','black']:['white']) {
        const candidate=await open('candidate');const control=await open('control');
        try {games.push(await playGame({...config,opening,candidateColor},candidate,control));}
        finally {
          const closing=await Promise.allSettled([candidate.close(),control.close()]);
          for(const result of closing)if(result.status==='rejected')failures.push(String(result.reason?.message??'owned process close failed').slice(0,2048));
          sessions.delete(candidate);sessions.delete(control);
        }
      }
    }
  }catch(error){failures.push(String(error.message).slice(0,2048));}
  finally{
    const closing=await Promise.allSettled([...sessions].map(s=>s.close()));
    for(const result of closing)if(result.status==='rejected')failures.push(String(result.reason?.message??'owned process close failed').slice(0,2048));
  }
  for(const game of games)if(game.failure)failures.push(game.failure);
  const status=failures.length?'failed':games.some(g=>!g.complete)?'incomplete':'completed';
  return {schema:'uci_arena_evidence_result_v2',request_id:request.request_id,job_id:request.job_id,shard_id:request.shard_id,
    workload:request.workload,target_identity:request.target_identity,runtime_identity:request.runtime_identity,
    status,completed:status==='completed',games,samples,engine_identities:identities,failures,
    qualification:{diagnostic:true,timing:false,strength:false,profile_publication:false,
      reasons:['timing_policy_and_statistical_qualification_not_declared']}};
}
