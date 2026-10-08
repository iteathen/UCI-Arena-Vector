import {createHash} from 'node:crypto';
import fs from 'node:fs';
import * as cuda from 'cuda-js';
import {buildEngineDomainModule} from './domain-device.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function qualifyLiveDomain(states){
  if(process.version!=='v26.11.1'||cuda.CUDA_JS_COMPATIBILITY.package.version!=='0.1.0-alpha.22')throw new Error('Live Domain exact cohort mismatch');
  const domain=buildEngineDomainModule();
  if(!Array.isArray(states)||!states.length||states.length>32||states.some(s=>!(s instanceof Uint32Array)||s.length!==domain.stateWords))throw new Error('Live Domain qualification requires bounded complete states');
  const input=new Uint32Array(states.length*domain.stateWords),output=new Uint32Array(states.length*8).fill(0xdeadbeef);states.forEach((s,i)=>input.set(s,i*domain.stateWords));
  // Qualification executes one case at a time, preserving the product scratch-base-zero ABI.
  const request={source:domain.source+`function qualifyLive(states,scratch,output,base,outputBase){cNormalizeHistory(states,base,scratch,gpu.u32(0));output[outputBase+gpu.u32(1)]=vDomainTerminal(states,base,output,outputBase+gpu.u32(2),scratch);}`,functions:[...domain.functions,{name:'qualifyLive',kind:'kernel',parameters:[{name:'states',type:'ptr<u32>'},{name:'scratch',type:'ptr<u32>'},{name:'output',type:'ptr<u32>'},{name:'base',type:'u32'},{name:'outputBase',type:'u32'}],returns:'void'}]};
  cuda.inspectDeviceProgram(request);
  const values=[input,new Uint32Array(71),output],sizes=values.map(v=>v.byteLength),resources=[];
  const runtime=await cuda.openCudaRuntime({compiler:true,driver:{memory:{maxDeviceBytes:sizes.reduce((a,b)=>a+b,0),maxAllocationBytes:Math.max(...sizes),maxTransferBytes:Math.max(...sizes)},execution:{maxArguments:5,maxModuleBytes:8*1024*1024,maxCompletionMilliseconds:30000}}});let result;
  try{
    const compiled=await cuda.compileDeviceProgram(runtime,request),memories=[];
    for(const value of values){const memory=await runtime.allocateDevice({byteLength:value.byteLength});resources.push(memory);memories.push(memory);await memory.write(new Uint8Array(value.buffer));}
    const module=await runtime.loadModule({format:compiled.compiler.artifact.format,bytes:compiled.compiler.artifact.bytes});resources.push(module);const k=compiled.deviceProgram.kernels[0],fn=await module.getFunction({name:k.functionName,parameters:k.parameters});resources.push(fn);
    const started=performance.now();
    for(let i=0;i<states.length;i++){
      const op=await fn.submit({grid:{x:1,y:1,z:1},block:{x:1,y:1,z:1},arguments:[...memories,i*domain.stateWords,i*8],accesses:sizes.map((byteLength,argumentIndex)=>({argumentIndex,byteOffset:0,byteLength,mode:'read-write'}))});
      resources.push(op);if((await op.wait()).status!=='completed')throw new Error('Live Domain qualification did not complete');await op.close();resources.pop();
    }
    const bytes=(await memories[2].read({byteLength:output.byteLength})).bytes,observed=new Uint32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4);
    result={schema:'vector_live_domain_qualification_v1',drawProfile:domain.drawProfile,node:process.version,cudaJs:cuda.CUDA_JS_COMPATIBILITY,environment:await runtime.describe(),sourceSha256:hash(request.source),artifactSha256:compiled.compiler.artifact.sha256,inputSha256:hash(new Uint8Array(input.buffer)),elapsedMilliseconds:performance.now()-started,rows:states.map((_,i)=>({terminal:observed[i*8+1],outcome:Array.from(observed.subarray(i*8+2,i*8+5)),guardsPassed:[0,5,6,7].every(j=>observed[i*8+j]===0xdeadbeef)}))};
  }finally{
    const failures=[];for(const resource of resources.reverse()){try{await resource.close();}catch(error){failures.push(error);break;}}
    const terminal=await runtime.close();if(failures.length||!terminal.graceful)throw new AggregateError(failures,'Live Domain cleanup unproved');if(result)result.terminal=terminal;
  }
  if(process.env.VECTOR_ENGINE_DOMAIN_RECEIPT)fs.writeFileSync(process.env.VECTOR_ENGINE_DOMAIN_RECEIPT,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  return result;
}
