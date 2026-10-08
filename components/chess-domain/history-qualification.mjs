import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {Chess} from 'chess.js';
import * as cuda from 'cuda-js';
import {buildDomainDeviceModule} from './device.mjs';
import {STATE_FORMAT,STATE_WORDS,HEADER_WORDS,admitPosition} from './admission.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const square=s=>s.charCodeAt(0)-97+(Number(s[1])-1)*8;
function oracleHeader(chess,historyCount,rawEnpassant){
  const fields=chess.fen().split(' '),words=new Uint32Array(71),types={p:1,n:2,b:3,r:4,q:5,k:6};
  for(const rank of chess.board())for(const piece of rank)if(piece)words[square(piece.square)]=types[piece.type]+(piece.color==='b'?6:0);
  words[64]=chess.turn()==='b'?1:0;for(const [right,bit] of [['K',1],['Q',2],['k',4],['q',8]])if(fields[2].includes(right))words[65]|=bit;
  words[66]=fields[3]==='-'?64:square(fields[3]);words[67]=Number(fields[4]);words[68]=Number(fields[5]);words[69]=historyCount;
  words[70]=rawEnpassant??words[66];return words;
}
function expectedTrace(fixture){
  const chess=new Chess(fixture.history[0]),trace=new Uint32Array(fixture.actions.length*73);let records=[oracleHeader(chess,1).slice(0,67)],final;
  fixture.actions.forEach((action,index)=>{
    const beforeRights=chess.fen().split(' ')[2],promotion=(action>>>12)&7,move=chess.move({from:String.fromCharCode(97+(action&7))+(((action&63)>>>3)+1),to:String.fromCharCode(97+((action>>>6)&7))+(((action>>>9)&7)+1),promotion:['','n','b','r','q'][promotion]});
    const reset=move.piece==='p'||move.captured||beforeRights!==chess.fen().split(' ')[2],rawEnpassant=move.piece==='p'&&Math.abs(square(move.to)-square(move.from))===16?(square(move.to)+square(move.from))/2:64,header=oracleHeader(chess,reset?1:records.length+1,rawEnpassant);
    if(reset)records=[];records.push(header.slice(0,67));final=new Uint32Array(71+records.length*67);final.set(header);records.forEach((r,i)=>final.set(r,71+i*67));
    let key=2166136261;for(const word of final)key=Math.imul(key^word,16777619)>>>0;
    const repetitions=records.filter(r=>r.every((word,i)=>word===header[i])).length;
    trace.set(header,index*73);trace[index*73+71]=repetitions;trace[index*73+72]=key;
  });return{trace,final};
}
export async function qualifyRelevantHistory(fixture){
  if(process.version!=='v26.11.1'||cuda.CUDA_JS_COMPATIBILITY.package.version!=='0.1.0-alpha.22')throw new Error('History native exact cohort mismatch');
  if(fixture.actions.length<1||fixture.actions.length>4096)throw new Error('History replay requires1..4096 externally supplied actions');
  const expected=expectedTrace(fixture),domain=buildDomainDeviceModule();
  const source=domain.source+`function replay(states,scratch,actions,trace,status,count){if(gpu.thread.globalX()!==gpu.u32(0)){return;}let base=gpu.u32(0);cNormalizeHistory(states,base,scratch,gpu.u32(0));status[gpu.u32(0)]=gpu.u32(0);for(let i=gpu.u32(0);i<count;i++){let destination=gpu.u32(${STATE_WORDS})-base;let result=cApply(states,base,states,destination,scratch,gpu.u32(0),actions[i]);if(result!==gpu.u32(0)){status[gpu.u32(0)]=result;status[gpu.u32(1)]=i;return;}base=destination;for(let j=gpu.u32(0);j<gpu.u32(71);j++){trace[i*gpu.u32(73)+j]=states[base+j];}trace[i*gpu.u32(73)+gpu.u32(71)]=cRepetitions(states,base);trace[i*gpu.u32(73)+gpu.u32(72)]=cIdentity(states,base);}status[gpu.u32(1)]=base;}`;
  const request={source,functions:[...domain.functions,{name:'replay',kind:'kernel',parameters:[{name:'states',type:'ptr<u32>'},{name:'scratch',type:'ptr<u32>'},{name:'actions',type:'ptr<u32>'},{name:'trace',type:'ptr<u32>'},{name:'status',type:'ptr<u32>'},{name:'count',type:'u32'}],returns:'void'}]};cuda.inspectDeviceProgram(request);
  const states=new Uint32Array(STATE_WORDS*2);states.set(admitPosition(fixture.history[0]).words);
  const values=[states,new Uint32Array(HEADER_WORDS),new Uint32Array(fixture.actions),new Uint32Array(expected.trace.length),new Uint32Array(2)],sizes=values.map(x=>x.byteLength),resources=[];
  const runtime=await cuda.openCudaRuntime({compiler:true,driver:{memory:{maxDeviceBytes:sizes.reduce((a,b)=>a+b,0),maxAllocationBytes:Math.max(...sizes),maxTransferBytes:Math.max(...sizes)},execution:{maxArguments:6,maxModuleBytes:8*1024*1024,maxCompletionMilliseconds:30000}}});let result,terminal;
  try{
    const compiled=await cuda.compileDeviceProgram(runtime,request),memories=[];for(const value of values){const memory=await runtime.allocateDevice({byteLength:value.byteLength});memories.push(memory);resources.push(memory);await memory.write(new Uint8Array(value.buffer));}
    const module=await runtime.loadModule({format:compiled.compiler.artifact.format,bytes:compiled.compiler.artifact.bytes});resources.push(module);const k=compiled.deviceProgram.kernels[0],fn=await module.getFunction({name:k.functionName,parameters:k.parameters});resources.push(fn);
    const start=performance.now(),op=await fn.submit({grid:{x:1,y:1,z:1},block:{x:1,y:1,z:1},arguments:[...memories,fixture.actions.length],accesses:sizes.map((byteLength,argumentIndex)=>({argumentIndex,byteOffset:0,byteLength,mode:argumentIndex===2?'read':'read-write'}))});resources.push(op);if((await op.wait()).status!=='completed')throw new Error('History replay did not complete');const elapsedMilliseconds=performance.now()-start;
    const read=async i=>{const b=(await memories[i].read({byteLength:sizes[i]})).bytes;return new Uint32Array(b.buffer,b.byteOffset,b.byteLength/4);};const status=await read(4),observed=await read(3),finalStates=await read(0),final=finalStates.subarray(status[1],status[1]+expected.final.length);
    let firstDivergence=null;for(let i=0;i<observed.length;i++)if(observed[i]!==expected.trace[i]){firstDivergence={ply:Math.floor(i/73),word:i%73,expected:expected.trace[i],observed:observed[i]};break;}
    let finalDivergence=null;for(let i=0;i<final.length;i++)if(final[i]!==expected.final[i]){finalDivergence={word:i,expected:expected.final[i],observed:final[i]};break;}
    result={schema:'vector_domain_relevant_history_qualification_v1',stateFormat:STATE_FORMAT,node:process.version,cudaJs:cuda.CUDA_JS_COMPATIBILITY,environment:await runtime.describe(),plies:fixture.actions.length,actionsSha256:hash(new Uint8Array(values[2].buffer)),sourceSha256:hash(source),artifactSha256:compiled.compiler.artifact.sha256,status:Array.from(status),elapsedMilliseconds,firstDivergence,finalDivergence,maximumHistoryCount:Math.max(...Array.from({length:fixture.actions.length},(_,i)=>observed[i*73+69])),allTransitionsAndHistoryPassed:status[0]===0&&!firstDivergence&&!finalDivergence};
  }finally{const failures=[];for(const resource of resources.reverse()){try{await resource.close();}catch(error){failures.push(error);break;}}terminal=await runtime.close();if(failures.length||!terminal.graceful)throw new AggregateError(failures,'History replay cleanup unproved');}
  result.terminal=terminal;
  if(process.env.VECTOR_HISTORY_RECEIPT_DIRECTORY){const directory=process.env.VECTOR_HISTORY_RECEIPT_DIRECTORY;fs.mkdirSync(directory,{recursive:true});const name=hash(fixture.history[0]+':'+result.actionsSha256)+'.json';fs.writeFileSync(path.join(directory,name),JSON.stringify(result,null,2)+'\n',{flag:'wx'});}
  else if(process.env.VECTOR_HISTORY_RECEIPT)fs.writeFileSync(process.env.VECTOR_HISTORY_RECEIPT,JSON.stringify(result,null,2)+'\n',{flag:'wx'});return result;
}
