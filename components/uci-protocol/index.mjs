import { admitPosition, actionToUci } from '../chess-domain/admission.mjs';

export const START_POSITION = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
export function uciToAction(move) {
  if (typeof move !== 'string' || !/^[a-h][1-8][a-h][1-8][nbrq]?$/.test(move)) throw new Error('Invalid UCI coordinate move');
  const square = offset => move.charCodeAt(offset) - 97 + (Number(move[offset + 1]) - 1) * 8;
  return square(0) | (square(2) << 6) | ((move.length === 5 ? ' nbrq'.indexOf(move[4]) : 0) << 12);
}
export function parseUciCommand(line) {
  if (typeof line !== 'string' || line.length > 65536 || /[\x00-\x1f\x7f]/.test(line)) throw new Error('UCI line exceeds admitted extent or contains control characters');
  if (/^\s*setoption(?:\s|$)/.test(line)) {
    const match = /^\s*setoption\s+name\s+(.+?)(?:\s+value(?:\s+(.*))?)?\s*$/.exec(line);
    if (!match) throw new Error('Invalid UCI setoption syntax');
    return {kind:'setoption',name:match[1].trim(),value:match[2] ?? ''};
  }
  const parts = line.trim().split(/\s+/), kind = parts.shift();
  if (kind === 'position') {
    let fen;
    if (parts[0] === 'startpos') { parts.shift(); fen = START_POSITION; }
    else if (parts[0] === 'fen') { parts.shift(); if (parts.length < 6 || parts.slice(0,6).includes('moves')) throw new Error('FEN requires six fields'); fen = parts.splice(0,6).join(' '); }
    else throw new Error('Unsupported UCI position');
    admitPosition(fen);
    if (parts.length && parts.shift() !== 'moves') throw new Error('Invalid UCI position suffix');
    if (parts.length > 4096) throw new Error('UCI position history capacity exceeded');
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
  if (command.wtime!==undefined||command.btime!==undefined) throw new Error('Remaining-clock allocation requires a qualified timing policy; current profile supports explicit movetime or infinite publication only');
  return null;
}

export function createUciController({port,write,now=()=>performance.now(),setTimer=setTimeout,clearTimer=clearTimeout,onDiagnostic}) {
  for (const method of ['ready','admitPosition','requestPublication','readPublication','close']) if(typeof port?.[method]!=='function') throw new Error(`GameSearchPort requires ${method}`);
  if(typeof write!=='function')throw new Error('UCI output writer is required');
  const options=new Map();
  for(const option of port.options??[]) {
    if(!option||typeof option.name!=='string'||!option.name||/[\x00-\x1f\x7f]/.test(option.name)||!['string','check','spin'].includes(option.type)||!['startup','next-go'].includes(option.apply??'startup')||(option.type==='string'&&(typeof option.default!=='string'||/[\x00-\x1f\x7f]/.test(option.default)))||(option.type==='check'&&typeof option.default!=='boolean')||(option.type==='spin'&&(![option.default,option.min,option.max].every(Number.isSafeInteger)||option.min>option.max||option.default<option.min||option.default>option.max))||options.has(option.name.toLowerCase()))throw new Error('Invalid advertised UCI option registry');
    options.set(option.name.toLowerCase(),Object.freeze({...option}));
  }
  if(options.size&&typeof port.configure!=='function')throw new Error('Advertised UCI options require configuration admission');
  let rootEpoch=0,requestId=0,sideToMove=0,admittedEpoch=0,hasPosition=false,newGame=true,admission=Promise.resolve(),retirement=Promise.resolve(),active=null,closed=false;
  let runtimeIdentity,readyPromise,configurationError,configuration=Promise.resolve();
  const diagnostic=(phase,facts={})=>{if(onDiagnostic)try{onDiagnostic({schema:'vector_uci_clock_phase_v1',phase,time:now(),rootEpoch,requestId,...facts});}catch{/* diagnostics cannot alter search/publication ownership */}};
  const ready=async()=>{
    await configuration;
    if(configurationError)throw configurationError;
    if(!readyPromise)readyPromise=Promise.resolve().then(()=>port.ready()).then(identity=>{if(identity!==undefined){if(identity?.schema!=='vector_engine_runtime_identity_v1')throw new Error('Backend public runtime identity schema mismatch');const encoded=JSON.stringify(identity);if(encoded.length>16384)throw new Error('Backend public runtime identity exceeds bounded extent');runtimeIdentity=encoded;}});
    return readyPromise;
  };
  const optionValues=Object.fromEntries([...options.values()].map(o=>[o.name,o.default]));
  const clearActive=()=>{if(active?.timer)clearTimer(active.timer);active=null;};
  const publicationFailure=(token,error)=>{if(closed||active!==token)return;clearActive();write('info string error '+String(error?.message??error).replace(/[\x00-\x1f\x7f]/g,' ').slice(0,512));};
  const pendingPublications=new Set();
  const poll = token => {
    if(closed||active!==token||token.rootEpoch!==rootEpoch)return;
    let result;try{result=port.readPublication({rootEpoch:token.rootEpoch,requestId:token.requestId});}catch(error){publicationFailure(token,error);return;}
    if(result) {
      const proof=result.legalProof;
      if(result.rootEpoch===rootEpoch&&result.requestId===token.requestId&&proof?.rootEpoch===rootEpoch&&proof.action===result.action&&proof.legal===true&&(result.action!==null||result.terminal===true)) {
        const text=result.action===null?'0000':actionToUci(result.action);
        clearActive();diagnostic('emit',{rootEpoch:token.rootEpoch,requestId:token.requestId,...(result.authority?{observation:{authority:result.authority,telemetry:result.telemetry,timing:result.timing,terminal:result.terminal}}:{})});write(`bestmove ${text}`);return;
      }
    }
    token.timer=setTimer(()=>poll(token),5);
  };
  const publish=token=>{if(active!==token||closed||token.requested||token.rootEpoch!==rootEpoch)return;if(admittedEpoch!==token.rootEpoch){token.stopPending=true;return;}token.requested=true;diagnostic('publicationRequested',{rootEpoch:token.rootEpoch,requestId:token.requestId});let result;try{result=port.requestPublication({rootEpoch:token.rootEpoch,requestId:token.requestId,searchmoves:token.command.searchmoves??[],...(options.size?{options:token.options}:{})});}catch(error){publicationFailure(token,error);return;}const pending=Promise.resolve(result).then(()=>{diagnostic('observerDelivered',{rootEpoch:token.rootEpoch,requestId:token.requestId});poll(token);}).catch(error=>publicationFailure(token,error));pendingPublications.add(pending);pending.then(()=>pendingPublications.delete(pending),()=>pendingPublications.delete(pending));};
  const schedule=token=>{const delay=publicationDelay(token.command,sideToMove);if(delay!==null)token.timer=setTimer(()=>publish(token),Math.max(0,delay-(now()-token.started)));};
  let closePromise;
  const close=()=>{if(!closePromise){closed=true;clearActive();closePromise=Promise.resolve().then(async()=>{await configuration;if(readyPromise)await readyPromise.catch(()=>{});await admission.catch(()=>{});await Promise.allSettled([...pendingPublications]);return port.close();});}return closePromise;};
  const handle=async line=>{
    if(closed)return;
    const command=parseUciCommand(line);
    diagnostic('commandReceived',{command:command.kind});
    if(command.kind==='uci'){write('id name UCI Arena Vector');write('id author iteathen');for(const option of options.values())write(`option name ${option.name} type ${option.type} default ${option.type==='string'?(option.default||'<empty>'):String(option.default)}${option.type==='spin'?` min ${option.min} max ${option.max}`:''}`);write('uciok');}
    else if(command.kind==='setoption'){
      const option=options.get(command.name.toLowerCase());
      if(!option)throw new Error('UCI option is not advertised');
      if(hasPosition&&(option.apply??'startup')!=='next-go')throw new Error('UCI configuration cannot change an admitted game');
      let value=command.value;
      if(option.type==='check'){if(!['true','false'].includes(value))throw new Error('Check option requires true or false');value=value==='true';}
      if(option.type==='spin'){if(!/^-?\d+$/.test(value)||!Number.isSafeInteger(Number(value))||Number(value)<option.min||Number(value)>option.max)throw new Error('Spin option integer outside declared range');value=Number(value);}
      const pending=configuration.then(async()=>{
        try{await port.configure({name:option.name,value});optionValues[option.name]=value;configurationError=undefined;readyPromise=undefined;runtimeIdentity=undefined;}
        catch(error){configurationError=error;throw error;}
      });
      configuration=pending.catch(()=>{});
      await pending;
    }
    else if(command.kind==='isready'){await retirement;await ready();if(!closed){if(runtimeIdentity)write(`info string vector_identity ${runtimeIdentity}`);write('readyok');}}
    else if(command.kind==='position') {
      clearActive();if(rootEpoch===0xffff_fffe)throw new Error('Root epoch exhausted');const epoch=++rootEpoch,establishGame=newGame;newGame=false;hasPosition=true;admittedEpoch=0;
      admission=admission.catch(()=>{}).then(()=>ready()).then(()=>{diagnostic('admissionStarted',{rootEpoch:epoch});return port.admitPosition({...command,rootEpoch:epoch,newGame:establishGame});}).then(result=>{if(result?.rootEpoch!==epoch||![0,1].includes(result.sideToMove))throw new Error('GPU position admission authority mismatch');diagnostic('admissionReady',{rootEpoch:epoch,...(result.observation?{observation:result.observation}:{})});if(epoch===rootEpoch){sideToMove=result.sideToMove;admittedEpoch=epoch;}}).catch(error=>{if(epoch===rootEpoch){hasPosition=false;clearActive();}throw error;});
      await admission;
    } else if(command.kind==='go') {
      if(!hasPosition)throw new Error('UCI go requires admitted position');publicationDelay(command,sideToMove);clearActive();if(requestId===0xffff_fffe)throw new Error('Publication request exhausted');
      const token={rootEpoch,requestId:++requestId,command,started:now(),requested:false,timer:null};active=token;
      diagnostic('goReceived',{rootEpoch:token.rootEpoch,requestId:token.requestId});
      await configuration;if(configurationError)throw configurationError;token.options=Object.freeze({...optionValues});await admission;if(active===token&&!closed){const intent=typeof port.preparePublicationIntent==='function'?await port.preparePublicationIntent({rootEpoch:token.rootEpoch,requestId:token.requestId,searchmoves:token.command.searchmoves??[],options:token.options}):null;if(active===token&&!closed){if(token.stopPending||intent?.bypassPublicationWait)publish(token);else schedule(token);}}
    } else if(command.kind==='stop'){if(active){if(active.timer)clearTimer(active.timer);publish(active);}}
    else if(command.kind==='ponderhit'){if(active?.command.ponder){delete active.command.ponder;active.started=now();schedule(active);}}
    else if(command.kind==='ucinewgame'){clearActive();hasPosition=false;admittedEpoch=0;newGame=true;admission=admission.catch(()=>{}).then(()=>typeof port.endGame==='function'?port.endGame():undefined).then(()=>{readyPromise=undefined;runtimeIdentity=undefined;});retirement=admission;await admission;}
    else if(command.kind==='quit')return close();
  };
  return Object.freeze({handle,close});
}
