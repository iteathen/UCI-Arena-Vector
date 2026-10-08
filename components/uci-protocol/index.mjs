import { admitPosition, actionToUci } from '../chess-domain/admission.mjs';

export const START_POSITION = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
export function uciToAction(move) {
  if (typeof move !== 'string' || !/^[a-h][1-8][a-h][1-8][nbrq]?$/.test(move)) throw new Error('Invalid UCI coordinate move');
  const square = offset => move.charCodeAt(offset) - 97 + (Number(move[offset + 1]) - 1) * 8;
  return square(0) | (square(2) << 6) | ((move.length === 5 ? ' nbrq'.indexOf(move[4]) : 0) << 12);
}
export function parseUciCommand(line) {
  if (typeof line !== 'string' || line.length > 16384) throw new Error('UCI line exceeds admitted extent');
  const parts = line.trim().split(/\s+/), kind = parts.shift();
  if (kind === 'position') {
    let fen;
    if (parts[0] === 'startpos') { parts.shift(); fen = START_POSITION; }
    else if (parts[0] === 'fen') { parts.shift(); if (parts.length < 6 || parts.slice(0,6).includes('moves')) throw new Error('FEN requires six fields'); fen = parts.splice(0,6).join(' '); }
    else throw new Error('Unsupported UCI position');
    admitPosition(fen);
    if (parts.length && parts.shift() !== 'moves') throw new Error('Invalid UCI position suffix');
    if (parts.length > 255) throw new Error('UCI position history capacity exceeded');
    return {kind,fen,moves:parts.map(uciToAction)};
  }
  if (kind === 'go') {
    const result = {kind};
    while (parts.length) {
      const key = parts.shift();
      if (Object.hasOwn(result,key)) throw new Error('Repeated UCI go field');
      if (['infinite','ponder'].includes(key)) result[key] = true;
      else if (key === 'searchmoves') { const moves=[]; while (parts.length && /^[a-h][1-8][a-h][1-8][nbrq]?$/.test(parts[0])) moves.push(uciToAction(parts.shift())); if (!moves.length) throw new Error('searchmoves requires coordinate moves'); result.searchmoves=moves; }
      else if (['movetime','wtime','btime','winc','binc','movestogo'].includes(key)) { const value=parts.shift(); if (!/^\d+$/.test(value ?? '') || !Number.isSafeInteger(Number(value)) || Number(value)>0xffff_fffe || (key==='movestogo' && Number(value)===0)) throw new Error('UCI time requires bounded nonnegative integer'); result[key]=Number(value); }
      else throw new Error(`Unsupported UCI search budget or field: ${key}`);
    }
    if (result.infinite && result.movetime !== undefined) throw new Error('Ambiguous UCI publication deadline');
    return result;
  }
  if (['uci','isready','ucinewgame','stop','ponderhit','quit'].includes(kind)) { if (parts.length) throw new Error('Unexpected UCI command suffix'); return {kind}; }
  return {kind:'ignored'};
}
export function publicationDelay(command, sideToMove) {
  if (command.infinite || command.ponder) return null;
  if (command.movetime !== undefined) return command.movetime;
  const remaining=command[sideToMove===0?'wtime':'btime'];
  if (remaining===undefined) return null;
  const increment=command[sideToMove===0?'winc':'binc'] ?? 0, reserve=Math.min(500,Math.max(10,remaining*0.05));
  return Math.max(0,Math.floor(Math.min(remaining-reserve,remaining/(command.movestogo??30)+increment*0.8)));
}

export function createUciController({port,write,now=()=>performance.now(),setTimer=setTimeout,clearTimer=clearTimeout}) {
  for (const method of ['ready','admitPosition','requestPublication','readPublication','close']) if(typeof port?.[method]!=='function') throw new Error(`GameSearchPort requires ${method}`);
  if(typeof write!=='function')throw new Error('UCI output writer is required');
  let rootEpoch=0,requestId=0,sideToMove=0,admittedEpoch=0,hasPosition=false,newGame=true,admission=Promise.resolve(),active=null,closed=false;
  const ready=Promise.resolve().then(()=>port.ready());
  const clearActive=()=>{if(active?.timer)clearTimer(active.timer);active=null;};
  const poll = token => {
    if(closed||active!==token||token.rootEpoch!==rootEpoch)return;
    const result=port.readPublication({rootEpoch:token.rootEpoch,requestId:token.requestId});
    if(result) {
      const proof=result.legalProof;
      if(result.rootEpoch===rootEpoch&&result.requestId===token.requestId&&proof?.rootEpoch===rootEpoch&&proof.action===result.action&&proof.legal===true&&(result.action!==null||result.terminal===true)) {
        const text=result.action===null?'0000':actionToUci(result.action);
        clearActive();write(`bestmove ${text}`);return;
      }
    }
    token.timer=setTimer(()=>poll(token),5);
  };
  const publish=token=>{if(active!==token||closed||token.requested||token.rootEpoch!==rootEpoch)return;if(admittedEpoch!==token.rootEpoch){token.stopPending=true;return;}token.requested=true;port.requestPublication({rootEpoch:token.rootEpoch,requestId:token.requestId,searchmoves:token.command.searchmoves??[]});poll(token);};
  const schedule=token=>{const delay=publicationDelay(token.command,sideToMove);if(delay!==null)token.timer=setTimer(()=>publish(token),Math.max(0,delay-(now()-token.started)));};
  const close=async()=>{if(closed)return{graceful:true};closed=true;clearActive();return port.close();};
  const handle=async line=>{
    if(closed)return;
    const command=parseUciCommand(line);
    if(command.kind==='uci'){write('id name UCI Arena Vector');write('id author iteathen');write('uciok');}
    else if(command.kind==='isready'){await ready;if(!closed)write('readyok');}
    else if(command.kind==='position') {
      clearActive();if(rootEpoch===0xffff_fffe)throw new Error('Root epoch exhausted');const epoch=++rootEpoch,establishGame=newGame;newGame=false;hasPosition=true;admittedEpoch=0;
      admission=admission.catch(()=>{}).then(()=>ready).then(()=>port.admitPosition({...command,rootEpoch:epoch,newGame:establishGame})).then(result=>{if(result?.rootEpoch!==epoch||![0,1].includes(result.sideToMove))throw new Error('GPU position admission authority mismatch');if(epoch===rootEpoch){sideToMove=result.sideToMove;admittedEpoch=epoch;}}).catch(error=>{if(epoch===rootEpoch){hasPosition=false;clearActive();}throw error;});
      await admission;
    } else if(command.kind==='go') {
      if(!hasPosition)throw new Error('UCI go requires admitted position');clearActive();if(requestId===0xffff_fffe)throw new Error('Publication request exhausted');
      const token={rootEpoch,requestId:++requestId,command,started:now(),requested:false,timer:null};active=token;
      await admission;if(active===token&&!closed){if(token.stopPending)publish(token);else schedule(token);}
    } else if(command.kind==='stop'){if(active){if(active.timer)clearTimer(active.timer);publish(active);}}
    else if(command.kind==='ponderhit'){if(active?.command.ponder){delete active.command.ponder;active.started=now();schedule(active);}}
    else if(command.kind==='ucinewgame'){clearActive();hasPosition=false;admittedEpoch=0;newGame=true;}
    else if(command.kind==='quit')return close();
  };
  return Object.freeze({handle,close});
}
