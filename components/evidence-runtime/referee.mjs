import { Chess } from 'chess.js';

export function createReferee(fen) {
  const chess = fen ? new Chess(fen) : new Chess();
  return Object.freeze({
    fen:()=>chess.fen(), turn:()=>chess.turn(), pgn:()=>chess.pgn(),
    play(move) {
      if(chess.isGameOver()) throw new Error('cannot move from terminal position');
      if(typeof move !== 'string' || !/^[a-h][1-8][a-h][1-8][qrbn]?$/u.test(move)) throw new Error('illegal UCI move');
      try { chess.move({from:move.slice(0,2),to:move.slice(2,4),...(move.length===5?{promotion:move[4]}:{})}); }
      catch { throw new Error('illegal UCI move'); }
    },
    terminal() {
      if(chess.isCheckmate()) return {result:chess.turn()==='w'?'0-1':'1-0',termination:'checkmate'};
      if(chess.isStalemate()) return {result:'1/2-1/2',termination:'stalemate'};
      if(chess.isThreefoldRepetition()) return {result:'1/2-1/2',termination:'threefold_repetition'};
      if(chess.isDrawByFiftyMoves()) return {result:'1/2-1/2',termination:'rule_50'};
      if(chess.isInsufficientMaterial()) return {result:'1/2-1/2',termination:'insufficient_material'};
      return null;
    },
  });
}
