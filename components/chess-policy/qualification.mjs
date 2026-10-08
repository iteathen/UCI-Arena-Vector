import fs from 'node:fs';
import * as cuda from 'cuda-js';
import { buildChessPolicyDeviceModule } from './device.mjs';
import { buildPolicyPublicationModule } from './publication.mjs';

export function buildPolicyQualificationProgram(){
  const policy=buildChessPolicyDeviceModule();
  const source=`function policyCheck(records,numeric,logits,indices,priors,out){
    if(gpu.thread.globalX()!==gpu.u32(0)){return;}
    out[gpu.u32(0)]=vNormalizePriors(logits,gpu.u32(0),indices,gpu.u32(0),priors,gpu.u32(0),gpu.u32(3));
    for(let j=gpu.u32(0);j<gpu.u32(3);j++){numeric[j*gpu.u32(4)+gpu.u32(1)]=priors[j];}
    out[gpu.u32(1)]=vChoose(records,gpu.u32(0),numeric,gpu.u32(0),gpu.u32(3),gpu.u32(1));
    out[gpu.u32(2)]=vChoose(records,gpu.u32(0),numeric,gpu.u32(0),gpu.u32(3),gpu.u32(0));
    records[gpu.u32(2)]=gpu.u32(1);out[gpu.u32(3)]=vProve(records,gpu.u32(0),gpu.u32(3));
    records[gpu.u32(2)]=gpu.u32(2);records[gpu.u32(8)]=gpu.u32(2);records[gpu.u32(14)]=gpu.u32(2);out[gpu.u32(4)]=vProve(records,gpu.u32(0),gpu.u32(3));
    records[gpu.u32(8)]=gpu.u32(3);out[gpu.u32(5)]=vProve(records,gpu.u32(0),gpu.u32(3));
    records[gpu.u32(14)]=gpu.u32(0);out[gpu.u32(6)]=vProve(records,gpu.u32(0),gpu.u32(3));
    records[gpu.u32(2)]=gpu.u32(1);records[gpu.u32(14)]=gpu.u32(99);out[gpu.u32(7)]=vProve(records,gpu.u32(0),gpu.u32(3));
    out[gpu.u32(8)]=vBackup(records,gpu.u32(18),gpu.u32(24),numeric,gpu.u32(12),gpu.u32(16),gpu.f32(0.25),gpu.u32(0));
    out[gpu.u32(9)]=vBackup(records,gpu.u32(18),gpu.u32(24),numeric,gpu.u32(12),gpu.u32(16),gpu.f32(42),gpu.u32(0));
  }`;
  return {source:policy.source+source,functions:[...policy.functions,{name:'policyCheck',kind:'kernel',parameters:[{name:'records',type:'ptr<u32>'},{name:'numeric',type:'ptr<f32>'},{name:'logits',type:'ptr<f32>'},{name:'indices',type:'ptr<i32>'},{name:'priors',type:'ptr<f32>'},{name:'out',type:'ptr<u32>'}],returns:'void'}]};
}
export const inspectPolicyQualification=()=>cuda.inspectDeviceProgram(buildPolicyQualificationProgram());
export function buildPublicationQualificationProgram(){
  const contribution=buildPolicyPublicationModule();
  const source=`function publicationCheck(records,numeric,snapshot,audit,out){
    if(gpu.thread.globalX()!==gpu.u32(0)){return;}
    out[gpu.u32(0)]=gpu.u32(0);for(let j=gpu.u32(0);j<gpu.u32(3);j++){snapshot[j*gpu.u32(6)]=records[j*gpu.u32(6)+gpu.u32(4)];out[gpu.u32(0)]=out[gpu.u32(0)]+vEncodeSnapshotRow(records,j*gpu.u32(6),numeric,j*gpu.u32(4),snapshot,j*gpu.u32(6)+gpu.u32(1));}
    out[gpu.u32(1)]=vChooseEncoded(snapshot,gpu.u32(0),gpu.u32(3));snapshot[gpu.u32(2)]=gpu.u32(1);out[gpu.u32(2)]=vChooseEncoded(snapshot,gpu.u32(0),gpu.u32(3));
    for(let j=gpu.u32(0);j<gpu.u32(18);j++){audit[j]=snapshot[j];}let chosen=vChooseEncoded(snapshot,gpu.u32(0),gpu.u32(3));let unchanged=gpu.u32(1);for(let j=gpu.u32(0);j<gpu.u32(18);j++){if(audit[j]!==snapshot[j]){unchanged=gpu.u32(0);}}out[gpu.u32(3)]=unchanged;
    snapshot[gpu.u32(14)]=gpu.u32(99);out[gpu.u32(4)]=vChooseEncoded(snapshot,gpu.u32(0),gpu.u32(3));out[gpu.u32(5)]=vChooseEncoded(snapshot,gpu.u32(0),gpu.u32(0));
    records[gpu.u32(2)]=gpu.u32(99);for(let j=gpu.u32(0);j<gpu.u32(5);j++){audit[j]=gpu.u32(12345);}out[gpu.u32(6)]=vEncodeSnapshotRow(records,gpu.u32(0),numeric,gpu.u32(0),audit,gpu.u32(0));unchanged=gpu.u32(1);for(let j=gpu.u32(0);j<gpu.u32(5);j++){if(audit[j]!==gpu.u32(12345)){unchanged=gpu.u32(0);}}out[gpu.u32(7)]=unchanged;
  }`;
  return{source:contribution.source+source,functions:[...contribution.functions,{name:'publicationCheck',kind:'kernel',parameters:[{name:'records',type:'ptr<u32>'},{name:'numeric',type:'ptr<f32>'},{name:'snapshot',type:'ptr<u32>'},{name:'audit',type:'ptr<u32>'},{name:'out',type:'ptr<u32>'}],returns:'void'}],compile:{headerProfile:'cuda-cccl'}};
}
export const inspectPublicationQualification=()=>cuda.inspectDeviceProgram(buildPublicationQualificationProgram());
export async function qualifyPolicyPublication(){
  if(process.version!=='v26.11.1'||cuda.CUDA_JS_COMPATIBILITY.package.version!=='0.1.0-alpha.21')throw new Error('Publication native exact cohort mismatch');
  const values=[new Uint32Array(18),new Float32Array(12),new Uint32Array(18),new Uint32Array(18),new Uint32Array(8)],resources=[];
  values[0][0]=10;values[0][6]=0;values[0][12]=20;values[0][4]=10;values[0][10]=20;values[0][16]=30;values[1][0]=-5;values[1][8]=2;values[1][1]=0.1;values[1][5]=0.2;values[1][9]=0.7;
  const sizes=values.map(v=>v.byteLength),runtime=await cuda.openCudaRuntime({compiler:true,driver:{memory:{maxDeviceBytes:sizes.reduce((a,b)=>a+b,0),maxAllocationBytes:Math.max(...sizes),maxTransferBytes:Math.max(...sizes)},execution:{maxArguments:5,maxModuleBytes:8*1024*1024,maxCompletionMilliseconds:30000}}});let result,terminal;
  try{
    const compiled=await cuda.compileDeviceProgram(runtime,buildPublicationQualificationProgram()),memories=[];
    for(const value of values){const memory=await runtime.allocateDevice({byteLength:value.byteLength});memories.push(memory);resources.push(memory);await memory.write(new Uint8Array(value.buffer));}
    const module=await runtime.loadModule({format:compiled.compiler.artifact.format,bytes:compiled.compiler.artifact.bytes});resources.push(module);const kernel=compiled.deviceProgram.kernels.find(k=>k.name==='publicationCheck'),fn=await module.getFunction({name:kernel.functionName,parameters:kernel.parameters});resources.push(fn);
    const operation=await fn.submit({grid:{x:1,y:1,z:1},block:{x:1,y:1,z:1},arguments:memories,accesses:sizes.map((byteLength,argumentIndex)=>({argumentIndex,byteLength,byteOffset:0,mode:'read-write'}))});resources.push(operation);if((await operation.wait()).status!=='completed')throw new Error('Publication qualification execution failed');
    const bytes=(await memories[4].read({byteLength:32})).bytes;
    result={node:process.version,compatibility:cuda.CUDA_JS_COMPATIBILITY,environment:await runtime.describe(),sourceIdentity:buildPolicyPublicationModule().sourceIdentity,compilerArtifact:{sha256:compiled.compiler.artifact.sha256,format:compiled.compiler.artifact.format,architecture:compiled.compiler.artifact.architecture},output:Array.from(new Uint32Array(bytes.buffer,bytes.byteOffset,8))};
  }finally{const failures=[];for(const resource of resources.reverse()){try{await resource.close();}catch(error){failures.push(error);break;}}terminal=await runtime.close();if(failures.length||!terminal.graceful)throw new AggregateError(failures,'Publication qualification cleanup unproved');}
  result.terminal=terminal;if(process.env.VECTOR_PUBLICATION_RECEIPT)fs.writeFileSync(process.env.VECTOR_PUBLICATION_RECEIPT,JSON.stringify(result,null,2)+'\n',{flag:'wx'});return result;
}
export async function qualifyChessPolicy(){
  if(process.version!=='v26.11.1'||cuda.CUDA_JS_COMPATIBILITY.package.version!=='0.1.0-alpha.21')throw new Error('Policy native exact cohort mismatch');
  const values=[new Uint32Array(30),new Float32Array(20),new Float32Array(4162),new Int32Array([5,19,4161]),new Float32Array(3),new Uint32Array(10)];
  values[0][0]=10;values[0][6]=0;values[0][12]=20;values[0][4]=10;values[0][10]=20;values[0][16]=30;
  values[1][0]=-5;values[1][8]=2;values[2][5]=-1;values[2][19]=0;values[2][4161]=1;
  const sizes=values.map(v=>v.byteLength),resources=[];let terminal,result;
  const runtime=await cuda.openCudaRuntime({compiler:true,driver:{memory:{maxDeviceBytes:sizes.reduce((a,b)=>a+b,0),maxAllocationBytes:Math.max(...sizes),maxTransferBytes:Math.max(...sizes)},execution:{maxArguments:6,maxModuleBytes:8*1024*1024,maxCompletionMilliseconds:30000}}});
  try{
    const compiled=await cuda.compileDeviceProgram(runtime,buildPolicyQualificationProgram()),memories=[];
    for(const value of values){const memory=await runtime.allocateDevice({byteLength:value.byteLength});memories.push(memory);resources.push(memory);await memory.write(new Uint8Array(value.buffer));}
    const module=await runtime.loadModule({format:compiled.compiler.artifact.format,bytes:compiled.compiler.artifact.bytes});resources.push(module);
    const kernel=compiled.deviceProgram.kernels.find(k=>k.name==='policyCheck'),fn=await module.getFunction({name:kernel.functionName,parameters:kernel.parameters});resources.push(fn);
    const operation=await fn.submit({grid:{x:1,y:1,z:1},block:{x:1,y:1,z:1},arguments:memories,accesses:sizes.map((byteLength,argumentIndex)=>({argumentIndex,byteLength,byteOffset:0,mode:argumentIndex===2||argumentIndex===3?'read':'read-write'}))});resources.push(operation);
    if((await operation.wait()).status!=='completed')throw new Error('Policy native operation failed');
    const read=async i=>{const bytes=(await memories[i].read({byteLength:sizes[i]})).bytes;return Array.from(new values[i].constructor(bytes.buffer,bytes.byteOffset,values[i].length));};
    const records=await read(0),numeric=await read(1);
    result={node:process.version,compatibility:cuda.CUDA_JS_COMPATIBILITY,environment:await runtime.describe(),sourceIdentity:buildChessPolicyDeviceModule().sourceIdentity,compilerArtifact:{sha256:compiled.compiler.artifact.sha256,format:compiled.compiler.artifact.format,architecture:compiled.compiler.artifact.architecture},results:await read(5),priors:await read(4),backupVisits:[records[18],records[24]],backupValues:[numeric[12],numeric[16]]};
  }finally{const failures=[];for(const resource of resources.reverse()){try{await resource.close();}catch(error){failures.push(error);break;}}terminal=await runtime.close();if(failures.length||!terminal.graceful)throw new AggregateError(failures,'Policy cleanup unproved');}
  result.terminal=terminal;
  if(process.env.VECTOR_POLICY_RECEIPT)fs.writeFileSync(process.env.VECTOR_POLICY_RECEIPT,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  return result;
}
