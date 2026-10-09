import {performance} from 'node:perf_hooks';
import {createReferee} from './referee.mjs';

function bound(value,min,max,label){if(!Number.isSafeInteger(value)||value<min||value>max)throw new Error(`invalid clock experiment ${label}`);return value;}
export async function playClockExperimentGame(config,candidate,reference){
  if(!['white','black'].includes(config.candidateColor))throw new Error('invalid candidate color');
  bound(config.initialTimeMs,1,3600000,'initial time');bound(config.incrementMs,0,60000,'increment');bound(config.maxPlies,1,2048,'ply bound');bound(config.responseTimeoutMs,100,300000,'response timeout');bound(config.maxDurationMs,1000,3600000,'duration');
  if(!config.opening||typeof config.opening.id!=='string'||!config.opening.id||!Array.isArray(config.opening.moves)||config.opening.moves.length>1024)throw new Error('invalid clock experiment opening');
  if(!config.referenceGo||Object.keys(config.referenceGo).length!==1||!Object.hasOwn(config.referenceGo,'movetime'))throw new Error('unsupported reference treatment');bound(config.referenceGo.movetime,1,60000,'reference movetime');
  const ref=createReferee(config.opening.fen,{rulesProfile:'orthodoxy-live-claims-v1'}),moves=[...config.opening.moves];for(const move of moves)ref.play(move);
  const clocks={white:config.initialTimeMs,black:config.initialTimeMs},records=[],started=performance.now();let outcome=ref.terminal(),failure=null;
  const updateFocus=async()=>{await candidate.position(config.opening.fen,[...moves]);await reference.position(config.opening.fen,[...moves]);};
  try{
    await updateFocus();
    for(let ply=0;!outcome&&ply<config.maxPlies;ply++){
      const remainingDuration=config.maxDurationMs-(performance.now()-started);if(remainingDuration<=0){outcome={result:null,termination:'duration_bound'};break;}
      const color=ref.turn()==='w'?'white':'black',owner=color===config.candidateColor?'candidate':'reference',session=owner==='candidate'?candidate:reference,prior={...clocks},before=ref.fen();
      const control=owner==='candidate'?{wtime:Math.max(0,Math.floor(clocks.white)),btime:Math.max(0,Math.floor(clocks.black)),winc:config.incrementMs,binc:config.incrementMs}:{...config.referenceGo};
      const {move,elapsed_ms,info=[]}=await session.go(control,Math.min(config.responseTimeoutMs,Math.max(1,remainingDuration)));
      if(!Number.isFinite(elapsed_ms)||elapsed_ms<0)throw new Error('invalid actual elapsed measurement');
      if(!Array.isArray(info)||info.length>256||info.some(line=>typeof line!=='string'||line.length>32768))throw new Error('invalid bounded UCI observations');
      clocks[color]-=elapsed_ms;
      const record={ply:moves.length,owner,color,fen:before,move,elapsed_ms,clock_before_ms:prior,info:[...info]};records.push(record);
      if(clocks[color]<=0){outcome={result:color==='white'?'0-1':'1-0',termination:'flag_fall'};record.clock_after_ms={...clocks};break;}
      try{ref.play(move);}catch{outcome={result:null,termination:'illegal_move'};failure='engine returned illegal move';break;}
      clocks[color]+=config.incrementMs;record.clock_after_ms={...clocks};moves.push(move);outcome=ref.terminal();
      // The real target searches through the opponent's turn and receives every
      // accepted own/opponent/terminal update; observation never drives search.
      await updateFocus();
    }
  }catch(error){outcome={result:null,termination:'engine_failure'};failure=String(error?.message??error).slice(0,2048);}
  outcome??={result:null,termination:'max_plies'};
  return {schema:'vector_clock_experiment_game_v1',diagnostic:true,rules_profile:'orthodoxy-live-claims-v1',opening_id:config.opening.id,candidate_color:config.candidateColor,...outcome,complete:!['flag_fall','max_plies','duration_bound','illegal_move','engine_failure'].includes(outcome.termination),legal:!['illegal_move','engine_failure'].includes(outcome.termination),records,clocks_ms:clocks,final_fen:ref.fen(),pgn:ref.pgn(),failure,qualification:{timing:false,strength:false,useful_blocks:false,publication:false}};
}
