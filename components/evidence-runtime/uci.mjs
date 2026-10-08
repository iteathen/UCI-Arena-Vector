import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';

export class UciSession {
  constructor(launch,options={}) {
    this.closed=false;this.options=options;this.lines=[];this.buffer='';this.bytes=0;this.waiter=null;this.failure=null;
    this.process=spawn(launch.executable,launch.args,{cwd:launch.cwd,env:{...process.env},stdio:['pipe','pipe','pipe'],windowsHide:true});
    this.exited=new Promise(resolve=>this.process.once('close',()=>resolve()));
    this.process.once('exit',(code,signal)=>{
      this.failure??=new Error(`UCI process exited (${code??signal})`);this.wake();
    });
    this.process.once('error',error=>{this.failure=error;this.wake();});
    this.process.stdin.on('error',error=>{this.failure=error;this.wake();});
    this.process.stderr.on('data',bytes=>{
      // Drain bounded diagnostics without disclosing arbitrary child output.
      this.stderrBytes=(this.stderrBytes??0)+bytes.length;
      if(this.stderrBytes>1048576){this.failure=new Error('UCI stderr exceeded limit');this.wake();this.process.kill();}
    });
    this.process.stdout.on('data',bytes=>{
      this.bytes+=bytes.length;
      if(this.bytes>16777216){this.failure=new Error('UCI output exceeded limit');this.wake();this.process.kill();return;}
      this.buffer+=bytes.toString('utf8');
      if(this.buffer.length>1048576){this.failure=new Error('UCI line exceeded limit');this.wake();this.process.kill();return;}
      let offset;
      while((offset=this.buffer.indexOf('\n'))!==-1){this.lines.push(this.buffer.slice(0,offset).replace(/\r$/u,''));this.buffer=this.buffer.slice(offset+1);}
      if(this.lines.length>100000){this.failure=new Error('UCI queue exceeded limit');this.process.kill();}
      this.wake();
    });
  }
  wake(){if(this.waiter){const waiter=this.waiter;this.waiter=null;waiter();}}
  send(line){if(this.closed||this.failure)throw this.failure??new Error('UCI session closed');this.process.stdin.write(`${line}\n`);}
  async until(predicate,timeoutMs) {
    const deadline=performance.now()+timeoutMs;const seen=[];
    while(true) {
      while(this.lines.length){const line=this.lines.shift();seen.push(line);if(predicate(line))return seen;}
      if(this.failure)throw this.failure;
      const remaining=deadline-performance.now();if(remaining<=0)throw new Error('UCI response timeout');
      await new Promise(resolve=>{const timer=setTimeout(()=>{this.waiter=null;resolve();},remaining);this.waiter=()=>{clearTimeout(timer);resolve();};});
    }
  }
  async ready() {
    this.send('uci');const lines=await this.until(line=>line==='uciok',300000);
    const declared=new Set(lines.flatMap(line=>{const match=/^option name (.+?) type /u.exec(line);return match?[match[1]]:[];}));
    for(const [name,value]of Object.entries(this.options)) {
      if(!declared.has(name))throw new Error(`undeclared UCI option ${name}`);
      if(typeof value!=='string'&&typeof value!=='number'&&typeof value!=='boolean')throw new Error('invalid UCI option value');
      if(/[\r\n\u0000]/u.test(name+String(value)))throw new Error('unsafe UCI option');
      this.send(`setoption name ${name} value ${value}`);
    }
    this.send('ucinewgame');this.send('isready');const ready=await this.until(line=>line==='readyok',300000);
    const identities=ready.filter(line=>line.startsWith('info string vector_identity '));
    if(identities.length!==1)throw new Error('UCI runtime identity is missing or ambiguous');
    const identity=JSON.parse(identities[0].slice('info string vector_identity '.length));
    if(identity?.schema!=='vector_engine_runtime_identity_v1')throw new Error('UCI runtime identity schema mismatch');
    this.identity=identity;return identity;
  }
  async position(fen,moves) {
    if(fen!==undefined&&(typeof fen!=='string'||/[\r\n\u0000]/u.test(fen)))throw new Error('unsafe UCI position');
    if(!Array.isArray(moves)||moves.some(move=>typeof move!=='string'||!/^[a-h][1-8][a-h][1-8][qrbn]?$/u.test(move)))throw new Error('invalid UCI move history');
    this.send(`position ${fen?`fen ${fen}`:'startpos'}${moves.length?` moves ${moves.join(' ')}`:''}`);
  }
  async go(control,timeoutMs) {
    const fields=Object.entries(control);
    if(!fields.length||fields.some(([name,value])=>!['wtime','btime','winc','binc','movetime'].includes(name)||!Number.isSafeInteger(value)||value<0))throw new Error('invalid UCI go control');
    const start=performance.now();this.send(`go ${fields.map(([k,v])=>`${k} ${v}`).join(' ')}`);
    const lines=await this.until(line=>line.startsWith('bestmove '),timeoutMs);const elapsed=performance.now()-start;
    const best=lines.at(-1);const match=/^bestmove (\S+)(?: ponder (\S+))?$/u.exec(best);
    if(!match)throw new Error('malformed UCI bestmove');
    return {move:match[1],ponder:match[2]??null,elapsed_ms:elapsed,info:lines.filter(l=>l.startsWith('info ')).slice(-256)};
  }
  async close() {
    if(this.closed)return;this.closed=true;
    if(this.process.exitCode!==null||this.process.signalCode!==null)return;
    try{this.process.stdin.write('quit\n');}catch{}
    let timer;
    await Promise.race([this.exited,new Promise(resolve=>{timer=setTimeout(resolve,500);})]);clearTimeout(timer);
    if(this.process.exitCode===null&&this.process.signalCode===null){this.process.kill();await this.exited;}
  }
}
