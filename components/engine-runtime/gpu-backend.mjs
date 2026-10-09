import fs from 'node:fs';
import path from 'node:path';
import * as cudaJs from 'cuda-js';
import {prepareCudaJsExecution} from 'cuda-mcgs/runtime/cuda-js';
import {compileAdmittedModelProgram} from './model-program.mjs';
import {loadModelArtifacts} from './model-artifacts.mjs';
import {createChessColdSelection,admitChessOwnerProfiles,createChessResidentCore,composeChessResidentCore} from './cold-selection.mjs';
import {resolveExecutionPorts,createIgnitionResources} from './game-search-packets.mjs';
export const PUBLIC_PEER=Object.freeze({repository:'iteathen/CUDA-JS',revision:'dc2924657bb900cdce3fba4c9def62934419db03',package:'cuda-js@0.1.0-alpha.22'});
// Opaque submitDeviceContinuation has no implicit completion deadline.
// maxCompletionMilliseconds is the selected legacy/close policy, not game time.
export const NATIVE_RUNTIME_OPTIONS=Object.freeze({compiler:true,driver:{memory:{maxDeviceBytes:256*1024*1024,maxAllocationBytes:128*1024*1024,maxTransferBytes:64*1024*1024},execution:{maxModuleBytes:32*1024*1024,maxArguments:64,maxCompletionMilliseconds:300000,maxPendingGpuOperations:2}}});
export async function prepareChessBackend({modelRoot,cacheDirectory=path.join(modelRoot,'compiler-cache'),revision}){
 if(typeof modelRoot!=='string'||!modelRoot||typeof revision!=='string'||!/^[0-9a-f]{40}$/.test(revision))throw new Error('Exact model directory/source revision required');
 const requestedRoot=path.resolve(modelRoot),qualification=JSON.parse(fs.readFileSync(path.join(requestedRoot,'model-qualification.json'),'utf8'));
 const assets=loadModelArtifacts({directory:requestedRoot,qualification,expectedCohort:{tensor:'0.1.0-alpha.10',cudaJs:'0.1.0-alpha.22',cudaJsRevision:PUBLIC_PEER.revision}});
 const root=fs.realpathSync(requestedRoot);
 const compiledModel=await compileAdmittedModelProgram({cacheDirectory}),cold=createChessColdSelection({deviceProgram:compiledModel.deviceProgram,revision}),selected=admitChessOwnerProfiles(cold),core=createChessResidentCore(selected),composition=composeChessResidentCore(selected,core);
 const allocated=core.programResources.filter(r=>r.materialization==='resident-storage'),bytes=allocated.reduce((n,r)=>n+BigInt(r.capacity),0n);
 if(bytes>BigInt(NATIVE_RUNTIME_OPTIONS.driver.memory.maxDeviceBytes)||allocated.some(r=>BigInt(r.capacity)>BigInt(NATIVE_RUNTIME_OPTIONS.driver.memory.maxAllocationBytes))||core.operations.some(o=>o.bindings.length>64))throw new Error('Actual resident package exceeds selected public runtime limits');
 const prepared=await prepareCudaJsExecution(composition.publication.executionPackage.normalized,{cudaJs,peer:PUBLIC_PEER,runtimeOptions:NATIVE_RUNTIME_OPTIONS,deviceImports:cold.model.deviceImports});
 try{const requirements=composition.publication.executionPackage.normalized.cudaJsAdapter,ports=resolveExecutionPorts(core,requirements),immutableInputs=Object.fromEntries(Object.keys(selected.artifactBindings).map(name=>{const parameter=cold.model.connector.parameters.find(p=>p.parameterName===name);return[name,{bytes:assets[parameter.name],sha256:selected.artifactBindings[name].contentSha256}];}));
  const storageInitialization=await prepared.preinitialize({resources:createIgnitionResources(requirements,new Uint8Array(core.protocol.packetWords*4),immutableInputs)});
  return {root,assets,compiledModel,cold,selected,core,composition,requirements,ports,prepared,storageInitialization,description:await prepared.describe()};}catch(error){await prepared.close();throw error;}
}
