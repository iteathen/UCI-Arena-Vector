import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export const MODEL_IDENTITY=Object.freeze({checkpointSha256:'39be73ad994a7615dfc5ba7d1988a3ed1c7596b363ec4c8100692f8f2374f026',parameterSha256:'8d8ce4d216911d9b0e9f58f58ade17e0ed3c23e8833636a3907237fef73ce548',parameterBytes:14551952,constantsSha256:'3d0509636010c4a35242e2c24d4cd0695110fac6a167b3f493b735f142757439',constantsBytes:40,mapperSha256:'c6e9b74da76d4e7dff2a199a33f56954b0aadd26e328561fd317901e4c505116',workspaceBytes:66389048,featureElements:2176,policyElements:8324,valueElements:2,maximumPolicyAbsoluteError:0.0002,maximumValueAbsoluteError:0.00002});
export const MODEL_LIBRARY_IDENTITY=Object.freeze({librarySha256:'08b4fb2ea01285eaf3f4789d2235a51e7a171c69e838e1424362ef31d4ffdb08',artifactSha256:'302b609e9fff490614234586b9ad2688851e8141627d50932202bc68f2944599',byteLength:7239507});
function readAsset(directory,name){if(typeof name!=='string'||!name||path.basename(name)!==name||name==='.'||name==='..'||name.includes('\\')||name.includes(':'))throw new Error('Model artifact path must be a single local filename');const root=fs.realpathSync(directory),target=fs.realpathSync(path.join(root,name));if(path.dirname(target)!==root)throw new Error('Model artifact path escapes admitted directory');return fs.readFileSync(target);}
export function rehydrateModelLibrary(directory,descriptor,qualified){
  const callable=descriptor.exports?.find(fn=>fn.name==='tensorRunItem'),types=['u32',...Array(6).fill('ptr<f32>')];
  if(!callable||callable.returns!=='u32'||callable.parameters?.length!==7||callable.parameters.some((p,i)=>p.type!==types[i]))throw new Error('Qualified Tensor public callable ABI mismatch');
  if(descriptor.sha256!==qualified.librarySha256||descriptor.artifact?.sha256!==qualified.artifactSha256)throw new Error('Qualified public library identity mismatch');
  const bytes=readAsset(directory,descriptor.artifact.bytesFile);
  if(bytes.byteLength!==descriptor.artifact.byteLength||hash(bytes)!==qualified.artifactSha256)throw new Error('Opaque public library artifact identity mismatch');
  const {bytesFile,...artifact}=descriptor.artifact;
  return Object.freeze({...descriptor,artifact:Object.freeze({...artifact,bytes:Uint8Array.from(bytes)})});
}
export function loadModelArtifacts({directory,qualification,expectedCohort}){
  const q=qualification;
  if(q?.schema!=='vector-real-successor-block32-model-observation-v1'||q.modelNumericalParityPassed!==true)throw new Error('Model requires completed independent physical qualification');
  if(!expectedCohort?.tensor||!expectedCohort.cudaJs||!expectedCohort.cudaJsRevision||q.node!=='v26.11.1'||q.tensorCompatibility?.package.version!==expectedCohort.tensor||q.tensorCompatibility?.cudaJs.version!==expectedCohort.cudaJs||q.tensorCompatibility?.cudaJs.protectedMainRevision!==expectedCohort.cudaJsRevision)throw new Error('Model physical qualification exact cohort mismatch');
  for(const key of ['checkpointSha256','parameterSha256','constantsSha256','mapperSha256'])if(q[key]!==MODEL_IDENTITY[key])throw new Error(`Model qualification ${key} identity mismatch`);
  for(const key of ['librarySha256','artifactSha256'])if(q.libraryArtifact?.[key]!==MODEL_LIBRARY_IDENTITY[key])throw new Error(`Selected model library ${key} identity mismatch`);
  if(q.failure||q.status!=='device_closed_inference_math_and_exact_latency_qualified'||q.profile!=='SPEC-0009-block32-v1'||q.workspaceBytes!==MODEL_IDENTITY.workspaceBytes||q.semanticNodeCount!==2216||q.cleanup?.session?.graceful!==true||q.cleanup?.runtime?.graceful!==true||q.cleanup.runtime.driver?.resourceCounts?.live!==0||q.cleanup.runtime.driver?.resourceCounts?.orphaned!==0)throw new Error('Model qualification profile or cleanup mismatch');
  if(q.batches?.length!==2||![1,2].every(count=>q.batches.some(batch=>batch.itemCapacity===2&&batch.itemCount===count&&batch.inputOutputWorkspaceGuardsPassed===true&&(count===2||batch.inactiveItemNoWritePassed===true)&&['policy','value'].every(head=>batch.observed[head].pass===true&&Number.isFinite(batch.observed[head].maximumAbsoluteError)&&batch.observed[head].maximumAbsoluteError<=(head==='policy'?MODEL_IDENTITY.maximumPolicyAbsoluteError:MODEL_IDENTITY.maximumValueAbsoluteError)))))throw new Error('Model qualification full/partial numerical or guard evidence missing');
  const parameters=readAsset(directory,'parameters.f32.bin'),constants=readAsset(directory,'constants.f32.bin');
  if(parameters.length!==MODEL_IDENTITY.parameterBytes||hash(parameters)!==MODEL_IDENTITY.parameterSha256||constants.length!==MODEL_IDENTITY.constantsBytes||hash(constants)!==MODEL_IDENTITY.constantsSha256)throw new Error('Model parameter/constants bytes mismatch');
  const descriptor=JSON.parse(readAsset(directory,'tensor-model-library.json'));
  const library=rehydrateModelLibrary(directory,descriptor,q.libraryArtifact);
  return Object.freeze({identity:MODEL_IDENTITY,parameters:Uint8Array.from(parameters),constants:Uint8Array.from(constants),library,qualification:q,participation:Object.freeze({kind:'block32',requiredThreads:32,block:{x:32,y:1,z:1},uniformItemIndex:true,uniformCall:true})});
}
