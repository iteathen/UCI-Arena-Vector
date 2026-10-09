// Qualification observations only. These helpers do not launch a provider,
// execute GPU work, choose moves, or grant production qualification.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {canonicalJson} from '../../components/root-knowledge/tablebase.mjs';
export const providerSelection=Object.freeze({componentId:'syzygy.root-provider',componentVersion:'2.1.0',innerManifestSha256:'942b7552dbe28479cf1fa08c45e439ab50546f8efac1e9551ebda770a5e3484f',contractSha256:'0c3863989e3fd596e4216f029b8ad691a04dd499daf563828a819b0bc72be83a',providerSource:'c254e225219f4805f3997e967000b4d802556282'});
export const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const repo=fileURLToPath(new URL('../../',import.meta.url));
const paths=['components/chess-domain','components/chess-policy','components/engine-runtime','components/root-knowledge','components/uci-protocol','contracts/root-tablebase-selection.json','dist/uci.mjs','test/engine-runtime/managed-knowledge-native.test.mjs','test/root-knowledge/native-observation.mjs','test/root-knowledge/tablebase-warming.native.test.mjs'];
export function bindingObservation({selection,providerRoot,configPath,configBytes}){
 assert.equal(selection.componentId,providerSelection.componentId,'final08 provider component');assert.equal(selection.version,providerSelection.componentVersion,'final08 provider version');assert.equal(selection.manifestSha256,providerSelection.innerManifestSha256,'final08 provider manifest');assert.equal(selection.contractSha256,providerSelection.contractSha256,'final08 provider contract');
 const config=JSON.parse(configBytes),canonicalSha256=sha(canonicalJson(config));
 const binding={schema:'vector_root_tablebase_binding_v2',selectionSha256:sha(canonicalJson(selection)),componentRoot:providerRoot,configuration:{path:configPath,canonicalSha256}};
 const bindingBytes=Buffer.from(JSON.stringify(binding,null,2)+'\n');
 return {providerSelection,binding,bindingBytes,bindingBytesSha256:sha(bindingBytes),bindingCanonicalSha256:sha(canonicalJson(binding)),configuration:{path:configPath,sha256:sha(configBytes),canonicalSha256,datasetManifestSha256:config.manifest_sha256,selectedFiles:config.selected_files}};
}
export async function captureNativeObservation({selection,providerRoot,configPath}){
 const git=args=>execFileSync('git',args,{cwd:repo,encoding:'utf8'}).trim(),revision=git(['rev-parse','HEAD']);
 assert(/^[0-9a-f]{40}$/.test(revision));assert.equal(git(['status','--porcelain']), '','Native receipt requires a clean exact source revision');
 if(process.env.VECTOR_UCI_SOURCE_REVISION)assert.equal(process.env.VECTOR_UCI_SOURCE_REVISION,revision,'Requested native source differs from executing checkout');
 assert.equal(process.versions.node,'26.11.1');const executable=await fs.realpath(process.execPath),nodeSha256=sha(await fs.readFile(executable));assert.equal(nodeSha256,'a619e2e09eb0d50ef4c733d678b4d22689d2afef138cd67fd3fa107b535f8819','Exact admitted Node executable');
 const sourceFiles=[];for(const name of git(['ls-files','--',...paths]).split('\n').filter(Boolean)){const bytes=await fs.readFile(path.join(repo,name));sourceFiles.push({path:name,bytes:bytes.length,sha256:sha(bytes)});}
 assert(sourceFiles.length>0);const exactSource={revision,files:sourceFiles,sha256:sha(canonicalJson(sourceFiles))};
 const bound=bindingObservation({selection,providerRoot,configPath,configBytes:await fs.readFile(configPath)}),manifestBytes=await fs.readFile(path.join(providerRoot,'package-manifest.json'));assert.equal(sha(manifestBytes),providerSelection.innerManifestSha256);
 const manifest=JSON.parse(manifestBytes),providerSourceFiles=[];
 for(const row of manifest.files.filter(r=>r.path.startsWith('app/')||r.path==='contracts/offline-root-knowledge-v2.json')){assert(/^(?:app|contracts)\/[A-Za-z0-9_.-]+$/.test(row.path));const bytes=await fs.readFile(path.join(providerRoot,row.path));assert.equal(bytes.length,row.bytes);assert.equal(sha(bytes),row.sha256);providerSourceFiles.push({path:row.path,bytes:bytes.length,sha256:sha(bytes)});}
 assert.equal(providerSourceFiles.find(r=>r.path==='contracts/offline-root-knowledge-v2.json')?.sha256,providerSelection.contractSha256);
 return {...bound,sourceRevision:revision,exactSource,node:{version:process.versions.node,executable,sha256:nodeSha256},providerSourceFiles,providerRoot};
}
export function assertJoinedObservation(receipt){
 assert.equal(receipt.joined,true);const f=receipt.semantic?.fields;assert(f);assert.equal(f.stopCause,2);assert.equal(f.drainDisposition,0);
 for(const name of ['activeWorkLease','backupPhase','pathProtections','evaluatorProtections','evaluatorRequestState','evaluatorBatchState','activePathOccurrences'])assert.equal(f[name],0,name);
 for(const [claims,releases]of [['edgeLeaseClaims','edgeLeaseReleases'],['workLeaseClaims','workLeaseReleases']]){assert(Number.isSafeInteger(f[claims])&&f[claims]>=0);assert.equal(f[claims],f[releases]);}
 for(const name of ['id','generation']){const words=receipt.semantic.acceptedCancel?.[name];assert(Array.isArray(words)&&words.length===4&&words.every(v=>Number.isInteger(v)&&v>=0&&v<=0xffffffff)&&words.some(v=>v!==0),'Actual accepted128bit cancel '+name);}
 assert.equal(receipt.cleanup?.status,'complete');assert.deepEqual(receipt.cleanup.failures,[]);assert.equal(receipt.cleanup.runtime.graceful,true);assert.equal(receipt.cleanup.runtime.driver.resourceCounts.live,0);assert.equal(receipt.cleanup.runtime.driver.resourceCounts.orphaned,0);
}
export function assertExternalObservation(receipt,generation){
 assert.equal(receipt.provider?.status,'closed');assert.equal(receipt.provider.drained,true);assert.equal(receipt.provider.failed,false);assert.equal(receipt.provider.provider_generation,generation);
 assert.equal(receipt.process?.code,0);assert.equal(receipt.process.signal,null);assert.equal(receipt.process.forced,false);
}
