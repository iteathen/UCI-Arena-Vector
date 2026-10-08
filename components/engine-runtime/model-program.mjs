import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {CUDA_JS_COMPATIBILITY,openCudaRuntime} from 'cuda-js';
import {CUDA_JS_TENSOR_COMPATIBILITY,TensorSession,compileTensorDeviceProgram} from 'cuda-js-tensor';
import {buildLatticeKnightFp32TensorProgram} from './model-program-source.mjs';
import {MODEL_IDENTITY,MODEL_LIBRARY_IDENTITY} from './model-artifacts.mjs';
import {createTensorEvaluatorConnector,createTensorEvaluatorRuntimeContribution} from 'cuda-mcgs/evaluator/cuda-js-tensor';
import {buildChessPolicyHooks} from './policy-hooks.mjs';
export function buildAdmittedModelProgram(){
  if(CUDA_JS_TENSOR_COMPATIBILITY.package.version!=='0.1.0-alpha.10'||CUDA_JS_COMPATIBILITY.package.version!=='0.1.0-alpha.22'||CUDA_JS_TENSOR_COMPATIBILITY.cudaJs.protectedMainRevision!=='dc2924657bb900cdce3fba4c9def62934419db03')throw new Error('Operational model public cohort mismatch');
  const source=fs.readFileSync(new URL('./model-program-source.mjs',import.meta.url));
  if(createHash('sha256').update(source).digest('hex')!==MODEL_IDENTITY.mapperSha256)throw new Error('Original model builder source identity mismatch');
  const built=buildLatticeKnightFp32TensorProgram({itemCapacity:2});
  if(built.program.nodes.length!==2216||built.parameterLayout.byteLength!==MODEL_IDENTITY.parameterBytes||built.program.outputs[0].spec.capacityShape[1]!==4162)throw new Error('Original model program structure mismatch');
  return Object.freeze({...built,cohort:Object.freeze({tensor:CUDA_JS_TENSOR_COMPATIBILITY.package.version,cudaJs:CUDA_JS_COMPATIBILITY.package.version,cudaJsRevision:CUDA_JS_TENSOR_COMPATIBILITY.cudaJs.protectedMainRevision})});
}
export function createAdmittedEvaluatorContribution(deviceProgram){
  if(deviceProgram?.library?.sha256!==MODEL_LIBRARY_IDENTITY.librarySha256||deviceProgram.itemCapacity!==2||deviceProgram.totalWorkspaceBytes!==MODEL_IDENTITY.workspaceBytes)throw new Error('Actual admitted model Tensor capability required');
  const connector=createTensorEvaluatorConnector(deviceProgram,{requestCapacity:1}),options={id:'evaluator.vector-latticeknight.runtime',participation:{kind:'collective-block',blockSize:32}},base=createTensorEvaluatorRuntimeContribution(connector,options);
  const select=(partitions,elements)=>{const matches=partitions.flatMap(partition=>partition.members.filter(member=>member.perItemElements===elements).map(member=>({partition,member})));if(matches.length!==1)throw new Error('Original model Evaluator member layout is ambiguous');return matches[0];};
  const features=select(base.requestInputPartitions,1088),policy=select(base.resultOutputPartitions,4162),value=select(base.resultOutputPartitions,1);
  if(policy.partition.id!==value.partition.id)throw new Error('Original model atomic result heads require the same selected partition');
  const hooks=buildChessPolicyHooks({evaluatorLayout:{requestInputPartition:features.partition,resultOutputPartition:policy.partition,featureParameter:features.member.parameterName,policyParameter:policy.member.parameterName,valueParameter:value.member.parameterName}});
  const runtime=createTensorEvaluatorRuntimeContribution(connector,{...options,inputEncoder:{source:hooks.evaluator.source,functions:hooks.evaluator.functions,entryPoint:hooks.evaluator.hooks.encodeEvaluation,externalFunctions:[]}});
  return Object.freeze({connector,runtime,policy:hooks,deviceImports:Object.freeze([runtime.device.createDeviceImport()])});
}
export async function compileAdmittedModelProgram({cacheDirectory}={}){
  if(process.version!=='v26.11.1')throw new Error('Operational compiler admission requires exact Node26.11.1');
  if(typeof cacheDirectory!=='string'||!cacheDirectory||!fs.statSync(cacheDirectory).isDirectory())throw new Error('An admitted public compiler cache directory is required');
  const built=buildAdmittedModelProgram(),started=performance.now(),cleanup={};
  const runtime=await openCudaRuntime({compiler:{cacheDirectory:path.resolve(cacheDirectory),cacheMode:'read-only'}});let session,deviceProgram,failure;
  try{
    session=await TensorSession.open(runtime);
    deviceProgram=await compileTensorDeviceProgram(session,built.plan,{itemCapacity:2,itemInputs:['features'],participation:'block32'});
    const library=deviceProgram.library;
    if(library.sha256!==MODEL_LIBRARY_IDENTITY.librarySha256||library.artifact.sha256!==MODEL_LIBRARY_IDENTITY.artifactSha256||library.artifact.byteLength!==MODEL_LIBRARY_IDENTITY.byteLength||deviceProgram.totalWorkspaceBytes!==MODEL_IDENTITY.workspaceBytes)throw new Error('Compiled public original model identity mismatch');
    deviceProgram.requireParticipation({block:{x:32,y:1,z:1},uniformItemIndex:true,uniformCall:true});
  }catch(error){failure=error;}
  try{
    if(session){cleanup.session=await session.close();if(!cleanup.session.graceful)throw new Error('Model compiler session cleanup unproved; runtime retained');}
    cleanup.runtime=await runtime.close();if(!cleanup.runtime.graceful||cleanup.runtime.driver.resourceCounts.live!==0||cleanup.runtime.driver.resourceCounts.orphaned!==0)throw new Error('Model compiler runtime cleanup unproved');
  }catch(error){throw new AggregateError([...(failure?[failure]:[]),error],'Public model compiler admission cleanup failed');}
  if(failure)throw failure;
  const elapsedMilliseconds=performance.now()-started;
  const record={schema:'vector_model_compiler_admission_v1',node:process.version,cohort:built.cohort,itemCapacity:2,semanticNodeCount:2216,callableIdentity:deviceProgram.compatibilityIdentity,librarySha256:deviceProgram.library.sha256,artifactSha256:deviceProgram.library.artifact.sha256,workspaceBytes:deviceProgram.totalWorkspaceBytes,elapsedMilliseconds,cleanup,activeExecutionRuntimeBorrowed:false,gpuInferenceClaimed:false};
  if(process.env.VECTOR_MODEL_ADMISSION_RECEIPT)fs.writeFileSync(process.env.VECTOR_MODEL_ADMISSION_RECEIPT,JSON.stringify(record,null,2)+'\n',{flag:'wx'});
  return Object.freeze({deviceProgram,cleanup,elapsedMilliseconds,record});
}
