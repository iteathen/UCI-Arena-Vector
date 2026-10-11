import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync, lstatSync} from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {buildRuntimeContract} from '../components/evidence-runtime/contract.mjs';

// One explicit 0.1.3 -> 0.1.4 metadata overlay. These are the original signed
// inputs, not a new runtime qualification or a general release lineage API.
export const PRIOR_013=Object.freeze({version:'0.1.3',runtimeCommit:'31d5873b47ea5d0bcf6a83728902d3a383787f6f',
  archiveSha256:'6b5736372980e103f0b8ecb7c1b3c288d90c5eae9b16333dc3287b815371e23c',
  manifestSha256:'01b3e3fd3b6f02ea928d4081559ddd22009275743202268badc6142bdd248815',
  closureSha256:'eb33483da00f4bac6bd3f5bfbaf34fa1adf2710350ed0f69b02482f75ee93084',
  qualificationSha256:'e96da0826b51ec4e0edc24b45dd5133257f14572e28d9a742343a0f6de62ed61',
  identityFileSha256:'c5939af07f74b4e84147488aa9d35fef1c33e7fcdfabb74d4d6d31dc2146011c',
  identityJsonSha256:'ec671b7addba49530c9afdde83b576821abec71c1190f9cd180cb6ec85554f8a',
  originalAdmissionSha256:'a2bca9ceaeeb91cac5d3f04289d19139a662ae8dd23a7e78688ff6e0d6e90126',
  freshAdmissionSha256:'57bd6494bd710767104b78e12e402dd5a1fec4b8b7337b8a77dd529aba68f876'});
const ASSETS=Object.freeze([
  {name:'uci_arena.vector-0.1.3-windows-x86_64.provider-result.json',sha256:'dd1cbd653d6fd5954dc27404401c303f2da5b69a8888a836138b791625f3163f',size_bytes:12945},
  {name:'uci_arena.vector-0.1.3-windows-x86_64.tar.gz',sha256:PRIOR_013.archiveSha256,size_bytes:62724616},
  {name:'uci_arena.vector-0.1.3-windows-x86_64.tar.gz.sigstore.json',sha256:'7e83593c043859ae4a04a85ffc73141af4b28aabe5b50ba61814a3330d45e2d5',size_bytes:29383}
]);
const refs=Object.freeze({prior_manifest:{path:'contracts/prior-runtime-manifest.json',sha256:PRIOR_013.manifestSha256},
  prior_closure:{path:'contracts/prior-runtime-closure.json',sha256:PRIOR_013.closureSha256},
  prior_admission:{path:'contracts/prior-runtime-admission.json',sha256:PRIOR_013.freshAdmissionSha256}});
const sha=b=>createHash('sha256').update(b).digest('hex'),COMMIT=/^[0-9a-f]{40}$/u;
function fail(){throw Error('profile-only release identity or preserved runtime differs');}
function exact(value,keys){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!==[...keys].sort().join(','))fail();}
function bytes(root,name,max=16*1024*1024){
  const filename=path.join(root,name),stat=lstatSync(filename);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size<1||stat.size>max)fail();return readFileSync(filename);
}
function admittedRecord(recordBytes){
  if(recordBytes.length>1024*1024||sha(recordBytes)!==PRIOR_013.freshAdmissionSha256)fail();
  const record=JSON.parse(recordBytes);
  exact(record,['schema','validation_mode','verifier_source_commit','trust_policy_sha256','original_verification_record_sha256','verified','assets']);
  if(record.schema!=='vector_013_runtime_admission_v1'||record.validation_mode!=='official'
    ||!COMMIT.test(record.verifier_source_commit)||! /^[0-9a-f]{64}$/u.test(record.trust_policy_sha256)
    ||record.original_verification_record_sha256!==PRIOR_013.originalAdmissionSha256||!isDeepStrictEqual(record.assets,ASSETS))fail();
  // The exact fresh record was issued through the existing common verifier.
  // Its immutable normalized result binds source, full predicate and originals.
  const v=record.verified;
  if(v.schema!=='arena_verified_component_provenance_v1'||v.component_id!=='uci_arena.vector'||v.component_version!==PRIOR_013.version
    ||v.source_repository!=='iteathen/UCI-Arena-Vector'||v.source_commit!==PRIOR_013.runtimeCommit||v.target_triple!=='windows-x86_64'
    ||v.artifact.sha256!==PRIOR_013.archiveSha256||v.component_manifest_sha256!==PRIOR_013.manifestSha256
    ||v.evidence.sha256!==ASSETS[0].sha256||v.bundle.sha256!==ASSETS[2].sha256)fail();
  return record;
}
export function admitPriorRuntimeAdmission({recordBytes,inputs}){
  const record=admittedRecord(recordBytes);
  exact(inputs,ASSETS.map(x=>x.name));
  for(const row of ASSETS){const b=inputs[row.name];if(!(b instanceof Uint8Array)||b.length!==row.size_bytes||sha(b)!==row.sha256)fail();}
  return Object.freeze({runtime_source_commit:PRIOR_013.runtimeCommit,admission_sha256:sha(recordBytes),verified:structuredClone(record.verified)});
}
export function assertMaintainedRuntimeSource({repositoryRoot,releaseCommit}){
  if(!COMMIT.test(releaseCommit??''))fail();
  const git=args=>execFileSync('git',['-C',repositoryRoot,...args],{encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024}).trim();
  if(git(['rev-parse','HEAD'])!==releaseCommit||git(['status','--porcelain'])
    ||git(['diff','--name-only',PRIOR_013.runtimeCommit,releaseCommit,'--','components','dist','tools/installer-integration.mjs']))fail();
  return {runtime_source_commit:PRIOR_013.runtimeCommit,release_source_commit:releaseCommit,maintained_runtime_source:'byte-identical-tracked-tree'};
}
export function profileOnlyReleaseMetadata(releaseCommit){
  if(!COMMIT.test(releaseCommit??''))fail();
  return {schema:'vector_profile_only_release_v1',release_source_commit:releaseCommit,prior_component_version:PRIOR_013.version,
    prior_archive_sha256:PRIOR_013.archiveSha256,...structuredClone(refs),prior_qualification_sha256:PRIOR_013.qualificationSha256,
    runtime_identity_file_sha256:PRIOR_013.identityFileSha256,runtime_identity_json_sha256:PRIOR_013.identityJsonSha256};
}
export function validateProfileOnlyRuntime(root,closure){
  if(closure.component_version!=='0.1.4'||closure.vector_commit!==PRIOR_013.runtimeCommit)fail();
  const selected=closure.profile_only_release;
  if(!selected||!isDeepStrictEqual(selected,profileOnlyReleaseMetadata(selected.release_source_commit)))fail();
  const documents={};
  for(const [key,ref] of Object.entries(refs)){
    const b=bytes(root,ref.path);if(sha(b)!==ref.sha256)fail();documents[key]=JSON.parse(b);
    if(key==='prior_admission')admittedRecord(b);
  }
  const prior=documents.prior_closure,manifest=documents.prior_manifest;
  if(prior.component_version!==PRIOR_013.version||prior.vector_commit!==PRIOR_013.runtimeCommit
    ||manifest.component_id!=='uci_arena.vector'||manifest.component_version!==PRIOR_013.version)fail();
  exact(closure,[...Object.keys(prior),'profile_only_release']);
  for(const [key,value] of Object.entries(prior))if(!['component_version','files'].includes(key)&&!isDeepStrictEqual(closure[key],value))fail();
  const map=new Map(prior.files.map(x=>[x.path,x.sha256]));
  if(map.size!==prior.files.length)fail();
  for(const [name,digest] of map){
    const old=manifest.files.find(x=>x.path===name);if(!old||old.sha256!==digest)fail();
  }
  const expected=new Map(map);
  // The sole previously inventoried metadata change is selected component
  // version, derived through the unchanged public Evidence contract generator.
  const contract='contracts/evidence-runtime-contract.json';
  const contractBytes=bytes(root,contract);
  if(!map.has(contract)||!isDeepStrictEqual(JSON.parse(contractBytes),buildRuntimeContract({componentVersion:'0.1.4',targetTriple:'windows-x86_64'})))fail();
  expected.set(contract,sha(contractBytes));
  for(const ref of Object.values(refs))expected.set(ref.path,ref.sha256);
  if(closure.files.length!==expected.size||closure.files.some(row=>expected.get(row.path)!==row.sha256)
    ||new Set(closure.files.map(row=>row.path)).size!==expected.size)fail();
  const identity=bytes(root,'contracts/runtime-identity.json');
  if(sha(identity)!==PRIOR_013.identityFileSha256||sha(JSON.stringify(JSON.parse(identity)))!==PRIOR_013.identityJsonSha256
    ||sha(bytes(root,prior.qualification.receipt))!==PRIOR_013.qualificationSha256)fail();
  return map;
}
