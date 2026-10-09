import { Chess } from 'chess.js';

export function createReferee(fen,{rulesProfile='adjudicated-claims-as-draw'}={}) {
  if(!['adjudicated-claims-as-draw','orthodoxy-live-claims-v1'].includes(rulesProfile))throw new Error('unsupported referee rules profile');
  const chess = fen ? new Chess(fen) : new Chess();
  const positions=new Map(),key=()=>chess.fen().split(' ').slice(0,4).join(' ');
  const count=()=>{const current=key();positions.set(current,(positions.get(current)??0)+1);};count();
  const terminal=()=>{
    if(chess.isCheckmate())return {result:chess.turn()==='w'?'0-1':'1-0',termination:'checkmate'};
    if(chess.isStalemate())return {result:'1/2-1/2',termination:'stalemate'};
    if(rulesProfile==='adjudicated-claims-as-draw'){
      if(chess.isThreefoldRepetition())return {result:'1/2-1/2',termination:'threefold_repetition'};
      if(chess.isDrawByFiftyMoves())return {result:'1/2-1/2',termination:'rule_50'};
    }else{
      if((positions.get(key())??0)>=5)return {result:'1/2-1/2',termination:'fivefold_repetition'};
      if(Number(chess.fen().split(' ')[4])>=150)return {result:'1/2-1/2',termination:'rule_75'};
    }
    if(chess.isInsufficientMaterial())return {result:'1/2-1/2',termination:'insufficient_material'};
    return null;
  };
  return Object.freeze({
    fen:()=>chess.fen(), turn:()=>chess.turn(), pgn:()=>chess.pgn(),
    play(move) {
      if(terminal()) throw new Error('cannot move from terminal position');
      if(typeof move !== 'string' || !/^[a-h][1-8][a-h][1-8][qrbn]?$/u.test(move)) throw new Error('illegal UCI move');
      try { chess.move({from:move.slice(0,2),to:move.slice(2,4),...(move.length===5?{promotion:move[4]}:{})}); }
      catch { throw new Error('illegal UCI move'); }
      count();
    },
    terminal,
  });
}
