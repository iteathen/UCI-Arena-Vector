import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {admitPosition,STATE_FORMAT} from '../../components/chess-domain/admission.mjs';
const require=createRequire(new URL('../../components/chess-domain/package.json',import.meta.url)),{Chess}=require('chess.js');
function historyOf(chess,moves){const history=[chess.fen()];for(const move of moves){chess.move(move);history.push(chess.fen());}return history;}
test('Domain1.2 host admission retains precisely the suffix after pawn/capture/rights loss',()=>{assert.equal(STATE_FORMAT,'vector.chess-mailbox-u32/1.2.0');const a=new Chess(),history=historyOf(a,['e4','Nf6']);assert.equal(admitPosition(a.fen(),{history}).words[69],2);for(const [fen,move] of [['4k3/8/8/8/8/8/3n4/3RK3 w - - 7 1','Rxd2'],['4k3/8/8/8/8/8/8/R3K3 w Q - 7 1','Ra2']]){const chess=new Chess(fen),past=historyOf(chess,[move]);const state=admitPosition(chess.fen(),{history:past});assert.equal(state.words[69],1);assert.equal(state.words[67],Number(chess.fen().split(' ')[4]));}});
test('all reversible repetitions remain authoritative and are never arbitrarily truncated',()=>{const chess=new Chess(),history=historyOf(chess,['Nf3','Nf6','Ng1','Ng8','Nf3','Nf6','Ng1','Ng8']);assert.equal(chess.isThreefoldRepetition(),true);assert.equal(admitPosition(chess.fen(),{history}).words[69],9);assert.throws(()=>admitPosition(chess.fen(),{history:Array(257).fill(chess.fen())}),/relevant|history/i);});
test('discarded irreversible prefix cannot differentiate identical current relevant states',()=>{const chess=new Chess(),history=historyOf(chess,['e4','Nf6','Nf3']);const all=admitPosition(chess.fen(),{history}),suffix=admitPosition(chess.fen(),{history:history.slice(1)});assert.deepEqual(all.words,suffix.words);});
export function longHistoryFixture(){
  const chess=new Chess(),history=[chess.fen()],actions=[];let seed=316,lastReset=0;
  for(let ply=0;ply<300;ply++){
    const moves=chess.moves({verbose:true});const half=Number(chess.fen().split(' ')[4]);
    const ranked=moves.map(move=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return{move,rank:seed+(half>=10&&(move.piece==='p'||move.captured)?4294967296:0)-(move.captured?2147483648:0)};}).sort((a,b)=>b.rank-a.rank);
    let chosen;const previous=chess.fen();
    for(const candidate of ranked){const result=chess.move(candidate.move);if(!chess.isGameOver()){chosen=result;break;}chess.undo();}
    assert(chosen,`independent long-game fixture stalled at ${ply}`);
    const square=s=>s.charCodeAt(0)-97+(Number(s[1])-1)*8,action=square(chosen.from)|(square(chosen.to)<<6)|((chosen.promotion?' nbrq'.indexOf(chosen.promotion):0)<<12);actions.push(action);history.push(chess.fen());
    if(chosen.piece==='p'||chosen.captured||previous.split(' ')[2]!==chess.fen().split(' ')[2])lastReset=ply+1;
  }
  return{history,actions,lastReset};
}
test('cold full-game admission accepts more than256plies while retaining every relevant record',()=>{const fixture=longHistoryFixture(),state=admitPosition(fixture.history.at(-1),{history:fixture.history});assert.equal(fixture.actions.length,300);assert.equal(state.words[69],fixture.history.length-fixture.lastReset);assert(state.words[69]<=101);});
test('physical Domain1.2 transitions preserve canonical reversible history beyond256plies',{skip:process.env.VECTOR_HISTORY_NATIVE!=='1'},async()=>{const {qualifyRelevantHistory}=await import('../../components/chess-domain/history-qualification.mjs');const fixture=longHistoryFixture();const receipt=await qualifyRelevantHistory(fixture);assert.equal(receipt.plies,300);assert.equal(receipt.allTransitionsAndHistoryPassed,true);assert.equal(receipt.terminal.graceful,true);assert.equal(receipt.terminal.driver.resourceCounts.live,0);assert.equal(receipt.terminal.driver.resourceCounts.orphaned,0);});
test('physical pawn/capture/rights loss reset history while reversible cycles preserve repetitions',{skip:process.env.VECTOR_HISTORY_NATIVE!=='1'},async()=>{const {qualifyRelevantHistory}=await import('../../components/chess-domain/history-qualification.mjs');for(const [fen,moves,count] of [[new Chess().fen(),['e4'],1],['4k3/8/8/8/8/8/3n4/3RK3 w - - 7 1',['Rxd2'],1],['4k3/8/8/8/8/8/8/R3K3 w Q - 7 1',['Ra2'],1],[new Chess().fen(),['Nf3','Nf6','Ng1','Ng8','Nf3','Nf6','Ng1','Ng8'],9]]){const chess=new Chess(fen),history=[fen],actions=[];for(const text of moves){const move=chess.move(text),sq=s=>s.charCodeAt(0)-97+(Number(s[1])-1)*8;actions.push(sq(move.from)|(sq(move.to)<<6)|((move.promotion?' nbrq'.indexOf(move.promotion):0)<<12));history.push(chess.fen());}const r=await qualifyRelevantHistory({history,actions});assert.equal(r.allTransitionsAndHistoryPassed,true);assert.equal(r.maximumHistoryCount,count);assert.equal(r.terminal.graceful,true);}});
