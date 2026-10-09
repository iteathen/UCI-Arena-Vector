import {createHash} from 'node:crypto';
import fs from 'node:fs';
import * as cuda from 'cuda-js';
import {admitPosition} from '../chess-domain/admission.mjs';
import {buildChessPolicyHooks} from './policy-hooks.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
export async function qualifyPolicyHooks({evaluatorLayout}){
  if(process.version!=='v26.11.1'||cuda.CUDA_JS_COMPATIBILITY.package.version!=='0.1.0-alpha.22')throw new Error('Policy physical exact cohort mismatch');
  const policy=buildChessPolicyHooks({evaluatorLayout});
  const kernel=`function qualifyPolicy(state,records,numeric,results,output,mode){
    vPolicyInitializeNode(state,gpu.u32(0),records,gpu.u32(0),numeric,gpu.u32(0));
    vPolicyInitializeCandidate(state,gpu.u32(0),records,gpu.u32(32),records,gpu.u32(6),numeric,gpu.u32(4));
    vPolicyInitializeCandidate(state,gpu.u32(0),records,gpu.u32(33),records,gpu.u32(12),numeric,gpu.u32(8));
    if(mode===gpu.u32(1)){results[gpu.u32(${policy.resultLayout.valueOffset})]=gpu.f32(1.5);}
    output[gpu.u32(0)]=vPolicyConsumeEvaluation(state,gpu.u32(0),records,gpu.u32(0),numeric,gpu.u32(0),records,gpu.u32(32),records,gpu.u32(6),numeric,gpu.u32(4),gpu.u32(2),results,gpu.u32(0),numeric,gpu.u32(20));
    if(mode===gpu.u32(1)){return;}
    output[gpu.u32(1)]=vPolicyClassifyFrontier(state,gpu.u32(0),records,gpu.u32(0),numeric,gpu.u32(0),numeric,gpu.u32(20),gpu.u32(0),gpu.u32(0),gpu.u32(0));
    output[gpu.u32(2)]=vPolicyClassifyFrontier(state,gpu.u32(0),records,gpu.u32(0),numeric,gpu.u32(0),numeric,gpu.u32(20),gpu.u32(4),gpu.u32(2),gpu.u32(0));
    output[gpu.u32(3)]=vPolicyReserve(records,gpu.u32(6),gpu.u32(7));output[gpu.u32(4)]=vPolicyReserve(records,gpu.u32(6),gpu.u32(7));
    vPolicyRelease(records,gpu.u32(6),gpu.u32(8),gpu.u32(0));output[gpu.u32(5)]=records[gpu.u32(7)];vPolicyRelease(records,gpu.u32(6),gpu.u32(7),gpu.u32(0));output[gpu.u32(6)]=records[gpu.u32(7)];
    records[gpu.u32(20)]=gpu.u32(2);records[gpu.u32(30)]=gpu.u32(1);records[gpu.u32(31)]=gpu.u32(0);
    if(mode===gpu.u32(2)){records[gpu.u32(8)]=gpu.u32(1);records[gpu.u32(20)]=gpu.u32(99);records[gpu.u32(30)]=gpu.u32(2);}
    if(mode===gpu.u32(3)){records[gpu.u32(20)]=gpu.u32(99);}
    output[gpu.u32(7)]=vPolicyPrepare(records,gpu.u32(0),gpu.u32(7),gpu.u32(1));
    output[gpu.u32(8)]=vPolicyApply(records,gpu.u32(0),gpu.u32(4294967295),numeric,gpu.u32(0),gpu.u32(4294967295),numeric,gpu.u32(20),state,gpu.u32(0),state,gpu.u32(4294967295),records,gpu.u32(4294967295),records,gpu.u32(32),records,gpu.u32(6),numeric,gpu.u32(4),records,gpu.u32(18),numeric,gpu.u32(12),records,gpu.u32(30),gpu.u32(2),true,gpu.u32(0),gpu.u32(7));
    if(output[gpu.u32(8)]===gpu.u32(0)){vPolicyComplete(records,gpu.u32(0),gpu.u32(7));output[gpu.u32(9)]=vPolicyPrepare(records,gpu.u32(0),gpu.u32(7),gpu.u32(1));}
    if(mode===gpu.u32(0)){
      records[gpu.u32(40)]=gpu.u32(9999999);output[gpu.u32(10)]=vPolicyPrepare(records,gpu.u32(40),gpu.u32(9),gpu.u32(2));output[gpu.u32(11)]=vPolicyPrepare(records,gpu.u32(40),gpu.u32(9),gpu.u32(1));vPolicyAbandon(records,gpu.u32(40),gpu.u32(9),gpu.u32(2));output[gpu.u32(12)]=records[gpu.u32(41)];
      output[gpu.u32(13)]=vPolicyRetirePolicy(records,gpu.u32(0),numeric,gpu.u32(0),records,gpu.u32(6),numeric,gpu.u32(4),gpu.u32(2));output[gpu.u32(14)]=vPolicyPrepare(records,gpu.u32(0),gpu.u32(9),gpu.u32(1));output[gpu.u32(15)]=vPolicyRetirePolicy(records,gpu.u32(0),numeric,gpu.u32(0),records,gpu.u32(6),numeric,gpu.u32(4),gpu.u32(2));vPolicyAbandon(records,gpu.u32(0),gpu.u32(9),gpu.u32(2));output[gpu.u32(16)]=vPolicyRetirePolicy(records,gpu.u32(0),numeric,gpu.u32(0),records,gpu.u32(6),numeric,gpu.u32(4),gpu.u32(2));
      output[gpu.u32(17)]=vPolicyEvaluateStop(records,gpu.u32(40),numeric,gpu.u32(0));records[gpu.u32(40)]=gpu.u32(10000000);output[gpu.u32(18)]=vPolicyEvaluateStop(records,gpu.u32(40),numeric,gpu.u32(0));records[gpu.u32(40)]=gpu.u32(10000001);output[gpu.u32(19)]=vPolicyEvaluateStop(records,gpu.u32(40),numeric,gpu.u32(0));records[gpu.u32(40)]=gpu.u32(9999999);output[gpu.u32(20)]=vPolicyEvaluateStop(records,gpu.u32(0),numeric,gpu.u32(0));
    }
  }`;
  const signatures=[...policy.evaluator.functions,...policy.functions].map(({calls,...signature})=>signature);
  const request={source:policy.evaluator.source+policy.source+kernel,functions:[...signatures,{name:'qualifyPolicy',kind:'kernel',parameters:[{name:'state',type:'ptr<u32>'},{name:'records',type:'ptr<u32>'},{name:'numeric',type:'ptr<f32>'},{name:'results',type:'ptr<f32>'},{name:'output',type:'ptr<u32>'},{name:'mode',type:'u32'}],returns:'void'}]};cuda.inspectDeviceProgram(request);
  const state=admitPosition('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1').words,records=new Uint32Array(80),numeric=new Float32Array(40),results=new Float32Array(evaluatorLayout.resultOutputPartition.elementCount),output=new Uint32Array(64).fill(0xdeadbeef);
  records[32]=1804;records[33]=1739;numeric[20]=0.5;results[policy.resultLayout.policyOffset+3364]=0;results[policy.resultLayout.policyOffset+3299]=Math.log(3);results[policy.resultLayout.valueOffset]=0.5;
  const values=[state,records,numeric,results,output],sizes=values.map(v=>v.byteLength),resources=[],observations=[];
  const runtime=await cuda.openCudaRuntime({compiler:true,driver:{memory:{maxDeviceBytes:sizes.reduce((a,b)=>a+b,0),maxAllocationBytes:Math.max(...sizes),maxTransferBytes:Math.max(...sizes)},execution:{maxArguments:6,maxModuleBytes:8*1024*1024,maxCompletionMilliseconds:30000}}});let report;
  try{
    const compiled=await cuda.compileDeviceProgram(runtime,request),memories=[];for(const v of values){const m=await runtime.allocateDevice({byteLength:v.byteLength});resources.push(m);memories.push(m);}
    const module=await runtime.loadModule({format:compiled.compiler.artifact.format,bytes:compiled.compiler.artifact.bytes});resources.push(module);const k=compiled.deviceProgram.kernels[0],fn=await module.getFunction({name:k.functionName,parameters:k.parameters});resources.push(fn);
    const read=async i=>{const b=(await memories[i].read({byteLength:sizes[i]})).bytes;return i===2?Array.from(new Float32Array(b.buffer,b.byteOffset,b.byteLength/4)):Array.from(new Uint32Array(b.buffer,b.byteOffset,b.byteLength/4));};
    for(let mode=0;mode<4;mode++){
      for(let i=0;i<values.length;i++)await memories[i].write(new Uint8Array(values[i].buffer));
      const started=performance.now(),op=await fn.submit({grid:{x:1,y:1,z:1},block:{x:1,y:1,z:1},arguments:[...memories,mode],accesses:sizes.map((byteLength,argumentIndex)=>({argumentIndex,byteOffset:0,byteLength,mode:argumentIndex===0?'read':'read-write'}))});resources.push(op);if((await op.wait()).status!=='completed')throw new Error('Policy contribution did not complete');await op.close();resources.pop();observations.push({mode,elapsedMilliseconds:performance.now()-started,status:await read(4),records:await read(1),numeric:await read(2)});
    }
    const [ready,invalid,stale,badChild]=observations,near=(a,b)=>Math.abs(a-b)<=1e-6,guards=observations.every(o=>o.status.slice(o.mode===0?21:o.mode===1?1:o.mode===3?9:10).every(v=>v===0xdeadbeef));
    report={schema:'vector_policy_ready_result_qualification_v1',node:process.version,cudaJs:cuda.CUDA_JS_COMPATIBILITY,environment:await runtime.describe(),sourceSha256:hash(request.source),artifactSha256:compiled.compiler.artifact.sha256,evaluatorLayout,observations,readyResultPassed:ready.status[0]===0&&near(ready.numeric[5],0.25)&&near(ready.numeric[9],0.75)&&ready.records[3]===1&&ready.status[1]===1&&ready.status[2]===0&&guards,invalidResultNoWritePassed:invalid.status[0]===1&&invalid.records.slice(0,6).every(v=>v===0)&&invalid.records[9]===0&&invalid.records[15]===0&&invalid.numeric[5]===0&&invalid.numeric[9]===0&&invalid.numeric[20]===0.5,lifecyclePassed:ready.status.slice(3,10).every((v,i)=>v===[0,1,8,0,0,0,1][i])&&ready.records[0]===1&&ready.records[1]===0&&ready.records[5]===8&&ready.records[2]===1&&ready.numeric[0]===1,staleChildProofRetained:stale.status[8]===0&&stale.records[2]===1&&stale.records[8]===1&&stale.records[20]===99,invalidReadyChildNoWritePassed:badChild.status[8]===1&&badChild.records[0]===0&&badChild.records[2]===0&&badChild.records[8]===0&&badChild.numeric[0]===0&&badChild.numeric[20]===0.5,aggregatePreflightPassed:ready.status[10]===1&&ready.status[11]===0&&ready.records[40]===9999999,abandonPreservesEvidence:ready.status[12]===0&&ready.records[45]===0&&ready.records[5]===8&&ready.records[2]===1&&ready.numeric[0]===1,retirementLeasePassed:ready.status[13]===0&&ready.status[14]===0&&ready.status[15]===1&&ready.status[16]===0,completeEnginePipelineClaimed:false};
  }finally{const failures=[];for(const resource of resources.reverse()){try{await resource.close();}catch(e){failures.push(e);break;}}const terminal=await runtime.close();if(failures.length||!terminal.graceful)throw new AggregateError(failures,'Policy physical cleanup unproved');if(report)report.terminal=terminal;}
  report.stopDispositionPassed=report.observations[0].status.slice(17,21).every((v,i)=>v===[0,1,2,1][i]);
  if(process.env.VECTOR_POLICY_HOOK_RECEIPT)fs.writeFileSync(process.env.VECTOR_POLICY_HOOK_RECEIPT,JSON.stringify(report,null,2)+'\n',{flag:'wx'});return report;
}
