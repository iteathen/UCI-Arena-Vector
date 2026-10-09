import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as cuda from 'cuda-js';
import {buildEngineDomainModule} from './domain-device.mjs';
import {sourceIdentity} from './profile-artifacts.mjs';
export function buildEngineSessionDomainModule(){
  const frozen=buildEngineDomainModule(),source=frozen.source+'\nfunction vDomainClassifyTransitionResult(status){if(status===gpu.u32(0)){return gpu.u32(0);}if(status===gpu.u32(1)){return gpu.u32(1);}if(status===gpu.u32(3)){return gpu.u32(2);}return gpu.u32(3);}\nfunction vDomainAdmitRoot(state,stateBase,domainScratch){if(!vDomainValid(state,stateBase,domainScratch)){return false;}cNormalizeHistory(state,stateBase,domainScratch,gpu.u32(0));return vDomainValid(state,stateBase,domainScratch);}\n';
  return{...frozen,source,functions:[...frozen.functions,{name:'vDomainClassifyTransitionResult',kind:'device',parameters:[{name:'status',type:'u32'}],returns:'u32'},{name:'vDomainAdmitRoot',kind:'device',parameters:[{name:'state',type:'ptr<u32>'},{name:'stateBase',type:'u32'},{name:'domainScratch',type:'ptr<u32>'}],returns:'bool'}],hooks:{...frozen.hooks,validateRoot:'vDomainAdmitRoot',classifyTransitionResult:'vDomainClassifyTransitionResult'},profileVersion:'1.2.2',transitionDispositions:{success:0,reject:1,pressure:2,fatal:3},sourceIdentity:sourceIdentity(source)};
}
export async function qualifyTransitionDispositions(){
  if(process.version!=='v26.11.1'||cuda.CUDA_JS_COMPATIBILITY.package.version!=='0.1.0-alpha.22')throw new Error('Transition qualification exact cohort mismatch');
  const domain=buildEngineSessionDomainModule(),statuses=new Uint32Array([0,1,3,4,2,4294967295]),output=new Uint32Array(8).fill(0xdeadbeef),resources=[],hash=bytes=>createHash('sha256').update(bytes).digest('hex');
  const request={source:domain.source+'\nfunction transitionProbe(statuses,output){for(let i=gpu.u32(0);i<gpu.u32(6);i++){output[gpu.u32(1)+i]=vDomainClassifyTransitionResult(statuses[i]);}}\n',functions:[...domain.functions,{name:'transitionProbe',kind:'kernel',parameters:[{name:'statuses',type:'ptr<u32>'},{name:'output',type:'ptr<u32>'}],returns:'void'}]};cuda.inspectDeviceProgram(request);
  const runtime=await cuda.openCudaRuntime({compiler:true,driver:{memory:{maxDeviceBytes:56,maxAllocationBytes:32,maxTransferBytes:32},execution:{maxArguments:2,maxModuleBytes:8*1024*1024,maxCompletionMilliseconds:30000}}});let report;
  try{
    const compiled=await cuda.compileDeviceProgram(runtime,request),inputs=[];
    for(const data of [statuses,output]){const memory=await runtime.allocateDevice({byteLength:data.byteLength});resources.push(memory);inputs.push(memory);await memory.write(new Uint8Array(data.buffer));}
    const module=await runtime.loadModule({format:compiled.compiler.artifact.format,bytes:compiled.compiler.artifact.bytes});resources.push(module);const k=compiled.deviceProgram.kernels[0],fn=await module.getFunction({name:k.functionName,parameters:k.parameters});resources.push(fn);
    const op=await fn.submit({grid:{x:1,y:1,z:1},block:{x:1,y:1,z:1},arguments:inputs,accesses:[{argumentIndex:0,byteOffset:0,byteLength:24,mode:'read'},{argumentIndex:1,byteOffset:0,byteLength:32,mode:'read-write'}]});resources.push(op);if((await op.wait()).status!=='completed')throw new Error('Transition disposition probe did not complete');
    const bytes=(await inputs[1].read({byteLength:32})).bytes,observed=new Uint32Array(bytes.buffer,bytes.byteOffset,8);
    report={schema:'vector_session_domain_transition_qualification_v1',node:process.version,profileVersion:domain.profileVersion,statuses:Array.from(statuses),dispositions:Array.from(observed.subarray(1,7)),guardsPassed:observed[0]===0xdeadbeef&&observed[7]===0xdeadbeef,sourceSha256:hash(request.source),artifactSha256:compiled.compiler.artifact.sha256,environment:await runtime.describe(),composedSearchClaimed:false};
  }finally{const failures=[];for(const resource of resources.reverse()){try{await resource.close();}catch(error){failures.push(error);break;}}const terminal=await runtime.close();if(failures.length||!terminal.graceful)throw new AggregateError(failures,'Transition qualifier cleanup unproved');if(report)report.terminal=terminal;}
  if(process.env.VECTOR_DOMAIN_TRANSITION_RECEIPT)fs.writeFileSync(process.env.VECTOR_DOMAIN_TRANSITION_RECEIPT,JSON.stringify(report,null,2)+'\n',{flag:'wx'});return report;
}
