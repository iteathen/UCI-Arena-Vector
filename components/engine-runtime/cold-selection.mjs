import {CUDA_JS_COMPATIBILITY} from 'cuda-js';
import {getAcceptedContractAuthority,createResidentPublicRequirements,residentDeviceSearchContract,deriveResidentDeviceSearchSource,createResidentGraphProfile,createResidentRuntimeProfiles,createResidentDeviceSearchCore,createResidentComposerInput,composeResolvedEngine} from 'cuda-mcgs/search-compiler';
import {createChessDomainProfile} from './domain-profile.mjs';
import {createAdmittedEvaluatorContribution} from './model-program.mjs';
import {createTensorEvaluatorProgramBinding,createTensorEvaluatorResourceBinding} from 'cuda-mcgs/evaluator/cuda-js-tensor';
import {sourceIdentity} from './profile-artifacts.mjs';
import {createChessEvaluatorProfile,createChessPolicyProfile} from './selected-profiles.mjs';
export const CHESS_RESIDENT_LAYOUT=Object.freeze({nodeCapacity:128,edgeCapacity:8192,ttCapacity:512,ttProbes:16,pathDepth:64,maxActions:256,stateWords:17223,actionWords:1,outcomeWords:3,nodeU32Words:6,nodeF32Words:4,edgeU32Words:6,edgeF32Words:4});
// This is the real selected source vocabulary for cold producer derivation.
// It deliberately contains no not-yet-normalized Graph/Evaluator references.
export function createChessColdSelection({deviceProgram,revision}){
  const authority=getAcceptedContractAuthority(),domain=createChessDomainProfile({authority,revision}),model=createAdmittedEvaluatorContribution(deviceProgram),policy={id:'policy.vector-chess',version:'1.0.0',evaluatorMode:'evaluation-only',programContribution:{sourceIdentity:sourceIdentity(model.policy.source)}},evaluatorOwnerProfile='evaluator.vector-latticeknight';
  const requirementSelection=createResidentPublicRequirements({cudaJsCompatibility:CUDA_JS_COMPATIBILITY,peer:{repository:'iteathen/CUDA-JS',revision:'dc2924657bb900cdce3fba4c9def62934419db03',package:'cuda-js@0.1.0-alpha.22'}});
  const hooks=Object.fromEntries(Object.entries({...domain.source.hooks,...model.policy.hooks,encodeEvaluation:model.policy.evaluator.hooks.encodeEvaluation}).map(([name,fn])=>{
    const selected=residentDeviceSearchContract.hooks[name];if(!selected)throw new Error(`Selected public source hook absent: ${name}`);
    return[name,{ownerProfile:Object.hasOwn(domain.source.hooks,name)?domain.normalized.id:name==='encodeEvaluation'?evaluatorOwnerProfile:policy.id,port:selected.port,function:fn}];
  }));
  const sourceBundles=[{ownerProfile:domain.normalized.id,source:domain.source.source,functions:domain.contributionFunctions},{ownerProfile:policy.id,source:model.policy.source,functions:model.policy.functions}];
  return Object.freeze({authority,domain,policy,evaluatorOwnerProfile,evaluatorRuntime:model.runtime,model,sourceBundles,hooks,layout:CHESS_RESIDENT_LAYOUT,requirementSelection,externalParameters:[{name:'domainScratch',type:'ptr<u32>',elementCount:71,ownerProfile:domain.normalized.id}],sourceProvenance:{origin:'first-party',revision,license:'GPL-3.0-or-later'}});
}
export function createChessResidentCore(admitted){
  const {cold,source,graph,evaluator,policy,resource,progress,output,session,resourceClasses,externalResourceClasses,artifactBindings}=admitted;
  return createResidentDeviceSearchCore({authority:cold.authority,domain:cold.domain,graph,evaluator,policy,resource,progress,output,session,evaluatorRuntime:cold.evaluatorRuntime,sourceDescriptor:source},{resourceClasses,externalResourceClasses,artifactBindings});
}
export function composeChessResidentCore(admitted,core){
  const {cold,source,graph,evaluator,policy,resource,progress,output,session}=admitted;
  const context={authority:cold.authority,domain:cold.domain,graph,evaluator,policy,resource,progress,output,session,evaluatorRuntime:cold.evaluatorRuntime,sourceDescriptor:source};
  const input=createResidentComposerInput(context,core,{revision:cold.sourceProvenance.revision,publicRequirementSelections:cold.requirementSelection.artifacts.map(({reference,document})=>({reference,document}))});
  return Object.freeze({input,publication:composeResolvedEngine(input.resolvedInput,cold.authority,input.compositionContext)});
}
export function admitChessOwnerProfiles(cold){
  const source=deriveResidentDeviceSearchSource({...cold,publicRequirements:cold.requirementSelection.publicRequirements},{name:'vectorGameSearch',layout:cold.layout,maxWork:10000000,maxRounds:'4294967294',maxAdmissionActions:4096,externalParameters:cold.externalParameters});
  const graph=createResidentGraphProfile({authority:cold.authority,domain:cold.domain,layout:source.layout,sourceIdentity:source.contributions.graph.sourceIdentity,provenance:cold.sourceProvenance});
  const evaluator=createChessEvaluatorProfile({authority:cold.authority,domain:cold.domain,graph,runtime:cold.evaluatorRuntime,revision:cold.sourceProvenance.revision,publicRequirements:cold.requirementSelection.publicRequirements.filter(ref=>cold.evaluatorRuntime.requiredCudaJsContracts.includes(ref.id))});
  const policy=createChessPolicyProfile({authority:cold.authority,domain:cold.domain,graph,evaluator,source:cold.model.policy,layout:source.layout,revision:cold.sourceProvenance.revision});
  const runtimeProfiles=createResidentRuntimeProfiles({authority:cold.authority,domain:cold.domain,graph,evaluator,policy,sourceDescriptor:source,provenance:cold.sourceProvenance});
  const evaluatorProgramBinding=createTensorEvaluatorProgramBinding(cold.evaluatorRuntime,evaluator.normalized,{id:'vector.latticeknight-program',workClasses:Object.fromEntries(['encode','admit','batch','execute','scatter','publish'].map(name=>[name,`${evaluator.normalized.id}.work-${name}`]))});
  const evaluatorResourceBinding=createTensorEvaluatorResourceBinding(cold.evaluatorRuntime,evaluator,runtimeProfiles.resource);
  const externalResourceClasses=Object.fromEntries(evaluatorResourceBinding.resourceBindings.map(b=>[b.parameterName,b.resourceClass])),artifactBindings={};
  const ownerClass=resourceId=>{const matches=runtimeProfiles.resource.normalized.classes.filter(c=>c.sourceResource===resourceId);if(matches.length!==1)throw new Error('Actual selected owner resource must have one canonical class');return matches[0];};
  externalResourceClasses.domainScratch=ownerClass('domain.vector-chess.scratch').id;
  for(const input of evaluatorResourceBinding.externalTensorParameters){const parameter=cold.model.connector.parameters.find(p=>p.parameterName===input.parameterName);if(!parameter||parameter.role!=='input'||!['parameters','constants'].includes(parameter.name))throw new Error('Original model immutable input meaning differs');const artifact=evaluator.normalized.artifacts.find(a=>a.id===`${evaluator.normalized.id}.${parameter.name}`),ownedResource=`${artifact?.id}.bytes`;if(!artifact||String(parameter.byteLength)!==artifact.maxBytes)throw new Error('Original model immutable input extent differs');externalResourceClasses[input.parameterName]=ownerClass(ownedResource).id;artifactBindings[input.parameterName]={ownerProfile:evaluator.normalized.id,artifactId:artifact.id,artifactIdentity:artifact.identity,evaluatorResource:ownedResource,contentSha256:artifact.provenance.contentSha256};}
  return Object.freeze({cold,source,graph,evaluator,policy,...runtimeProfiles,evaluatorProgramBinding,evaluatorResourceBinding,externalResourceClasses,artifactBindings});
}
