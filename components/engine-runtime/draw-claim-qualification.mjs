import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as cuda from 'cuda-js';
import {buildChessPolicyHooks} from './policy-hooks.mjs';
import {buildDomainDeviceModule} from '../chess-domain/device.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
export async function qualifyDrawClaims(cases,evaluatorLayout,{automaticThreefold=false}={}){
 if(process.version!=='v26.11.1'||cuda.CUDA_JS_COMPATIBILITY.package.version!=='0.1.0-alpha.22')throw new Error('Exact draw-claim qualification cohort required');
 const policy=buildChessPolicyHooks({evaluatorLayout,automaticThreefold}),extra=policy.functions.find(f=>f.name===policy.hooks.consumeEvaluation).parameters.length===18;
 const stateWords=17223,capacity=256,incoming=6+capacity*6,readyBase=incoming+6,valueBase=4*(capacity+2),scratchWords=17550;
 const kernel=`function claimProbe(state,actions,records,numeric,results,scratch,out,rows,restriction,count,proofMode){
 vPolicyInitializeNode(state,gpu.u32(0),records,gpu.u32(0),numeric,gpu.u32(0));
 for(let j=gpu.u32(0);j<count;j++){vPolicyInitializeCandidate(state,gpu.u32(0),actions,j,records,gpu.u32(6)+j*gpu.u32(6),numeric,gpu.u32(4)+j*gpu.u32(4));}
 out[gpu.u32(1)]=vPolicyConsumeEvaluation(state,gpu.u32(0),records,gpu.u32(0),numeric,gpu.u32(0),actions,gpu.u32(0),records,gpu.u32(6),numeric,gpu.u32(4),count,results,gpu.u32(0),numeric,gpu.u32(${valueBase})${extra?',scratch':''});
 if(out[gpu.u32(1)]!==gpu.u32(0)){return;}
 out[gpu.u32(2)]=vPolicyClassifyFrontier(state,gpu.u32(0),records,gpu.u32(0),numeric,gpu.u32(0),numeric,gpu.u32(${valueBase}),gpu.u32(64),gpu.u32(2),gpu.u32(0));
 for(let j=gpu.u32(0);j<count;j++){if(proofMode===gpu.u32(3)){records[gpu.u32(6)+j*gpu.u32(6)+gpu.u32(2)]=gpu.u32(1);}else if(proofMode===gpu.u32(2)){records[gpu.u32(6)+j*gpu.u32(6)+gpu.u32(2)]=gpu.u32(2);}else if(proofMode===gpu.u32(1)&&j===gpu.u32(0)){records[gpu.u32(8)]=gpu.u32(1);}}
 records[gpu.u32(1)]=gpu.u32(8);records[gpu.u32(${incoming+1})]=gpu.u32(8);
 out[gpu.u32(3)]=vPolicyApply(records,gpu.u32(0),gpu.u32(${incoming}),numeric,gpu.u32(0),gpu.u32(${4*(capacity+1)}),numeric,gpu.u32(${valueBase}),state,gpu.u32(0),state,gpu.u32(${stateWords}),actions,gpu.u32(0),actions,gpu.u32(0),records,gpu.u32(6),numeric,gpu.u32(4),records,gpu.u32(6),numeric,gpu.u32(4),records,gpu.u32(${readyBase}),count,true,gpu.u32(0),gpu.u32(7));
 let selected=vChoose(records,gpu.u32(6),numeric,gpu.u32(4),count,gpu.u32(0));out[gpu.u32(4)]=actions[selected];
 for(let j=gpu.u32(0);j<count;j++){rows[j*gpu.u32(6)]=actions[j];vPolicyEncodeSnapshotRow(records,gpu.u32(6)+j*gpu.u32(6),numeric,gpu.u32(4)+j*gpu.u32(4),rows,j*gpu.u32(6)+gpu.u32(1));}
 let encoded=vPolicyChooseEncoded(rows,gpu.u32(0),count,restriction);out[gpu.u32(5)]=actions[encoded];
 }`;
 const resources=[],observations=[],runtime=await cuda.openCudaRuntime({compiler:true,driver:{memory:{maxDeviceBytes:2*1024*1024,maxAllocationBytes:256*1024,maxTransferBytes:256*1024},execution:{maxArguments:11,maxModuleBytes:16*1024*1024,maxPendingGpuOperations:1,maxCompletionMilliseconds:30000}}});let report;
 try{
  const imports=[];let library;
  if(extra){const domain=buildDomainDeviceModule();library=await cuda.compileDeviceLibrary(runtime,{source:domain.source,functions:domain.functions,exports:['cApply','cRepetitions','cType']});for(const name of ['cApply','cRepetitions','cType'])imports.push({library:library.library,name,as:name});}
  const request={source:policy.evaluator.source+policy.source+kernel,functions:[...policy.evaluator.functions,...policy.functions].map(({calls,...f})=>f).concat({name:'claimProbe',kind:'kernel',parameters:[['state','ptr<u32>'],['actions','ptr<u32>'],['records','ptr<u32>'],['numeric','ptr<f32>'],['results','ptr<f32>'],['scratch','ptr<u32>'],['out','ptr<u32>'],['rows','ptr<u32>'],['restriction','ptr<u32>'],['count','u32'],['proofMode','u32']].map(([name,type])=>({name,type})),returns:'void'}),...(imports.length?{imports}:{})};
  cuda.inspectDeviceProgram(request);const compiled=await cuda.compileDeviceProgram(runtime,request),artifact=compiled.linker?.artifact??compiled.compiler.artifact;
  const module=await runtime.loadModule({format:artifact.format,bytes:artifact.bytes});resources.push(module);const k=compiled.deviceProgram.kernels[0],fn=await module.getFunction({name:k.functionName,parameters:k.parameters});resources.push(fn);
  for(const c of cases){
   const state=new Uint32Array(stateWords*2);state.set(c.state);state.set(c.parentState??c.state,stateWords);if(!c.parentState)state[stateWords+64]=1-state[64];
   const actions=new Uint32Array(capacity);actions.set(c.actions);const records=new Uint32Array(readyBase+capacity),numeric=new Float32Array(valueBase+2),results=new Float32Array(evaluatorLayout.resultOutputPartition.elementCount),scratch=new Uint32Array(scratchWords+2).fill(0xdeadbeef),out=new Uint32Array(7).fill(0xdeadbeef),rows=new Uint32Array(capacity*6),restriction=new Uint32Array(capacity+1);
   records[incoming+5]=c.incomingClaimMask??0;results[policy.resultLayout.valueOffset]=c.scalar;const values=[state,actions,records,numeric,results,scratch,out,rows,restriction],memories=[];
   for(const value of values){const m=await runtime.allocateDevice({byteLength:value.byteLength});resources.push(m);memories.push(m);await m.write(new Uint8Array(value.buffer));}
   const started=performance.now(),op=await fn.submit({grid:{x:1,y:1,z:1},block:{x:1,y:1,z:1},arguments:[...memories,c.actions.length,c.proofMode??0],accesses:values.map((v,argumentIndex)=>({argumentIndex,byteOffset:0,byteLength:argumentIndex===5?scratchWords*4:v.byteLength,mode:argumentIndex<2||argumentIndex===4?'read':'read-write'}))});resources.push(op);
   if((await op.wait()).status!=='completed')throw new Error('Draw-claim policy probe did not complete');await op.close();resources.pop();
   for(const index of [2,3,5,6]){const b=(await memories[index].read({byteLength:values[index].byteLength})).bytes;values[index].set(index===3?new Float32Array(b.buffer,b.byteOffset,b.byteLength/4):new Uint32Array(b.buffer,b.byteOffset,b.byteLength/4));}
   observations.push({name:c.name,scalar:c.scalar,actionCount:c.actions.length,claimMask:records[4],cacheValue:numeric[2],nodeSum:numeric[0],incomingSum:numeric[4*(capacity+1)],nodeProof:records[2],incomingProof:records[incoming+2],edges:c.actions.map((action,j)=>({action,claimMask:records[6+j*6+5],proof:records[6+j*6+2]})),selectedAction:out[4],encodedAction:out[5],statuses:Array.from(out.subarray(1,4)),guardsPassed:out[0]===0xdeadbeef&&out[6]===0xdeadbeef&&scratch[scratchWords]===0xdeadbeef&&scratch[scratchWords+1]===0xdeadbeef,elapsedMilliseconds:performance.now()-started});
   for(let j=0;j<memories.length;j++){await resources.at(-1).close();resources.pop();}
  }
  report={schema:'vector_draw_claim_policy_observation_v1',node:process.version,automaticThreefold,sourceSha256:hash(request.source),artifactSha256:artifact.sha256,domainLibrary:library?{sha256:library.library.sha256,artifactSha256:library.library.artifact.sha256}:null,publicCapabilitySuffix:extra,observations,environment:await runtime.describe(),claimLimits:['bounded device Policy algebra with independent supplied states/actions','synthetic NN scalar inputs, not model inference or playing strength','no full resident Graph/runtime/timing qualification']};
 }finally{for(const resource of resources.reverse())await resource.close();const terminal=await runtime.close();if(!terminal.graceful)throw new Error('Draw-claim qualifier cleanup unproved');if(report)report.terminal=terminal;}
 if(process.env.VECTOR_DRAW_CLAIM_RECEIPT)fs.writeFileSync(process.env.VECTOR_DRAW_CLAIM_RECEIPT,JSON.stringify(report,null,2)+'\n',{flag:'wx'});return report;
}
