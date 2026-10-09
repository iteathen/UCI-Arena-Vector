#!/usr/bin/env node
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync,lstatSync,mkdirSync,mkdtempSync,readFileSync,realpathSync,renameSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {isDeepStrictEqual} from 'node:util';
import {verifyAtomicComponent} from './component-package.mjs';

export const PROVIDER_PREDICATE_TYPE='https://uci-arena.example/attestations/provider-release-result/v1';
const REPOSITORY='iteathen/UCI-Arena-Vector',WORKFLOW='.github/workflows/component-release.yml';
const SHA=/^[0-9a-f]{64}$/u,COMMIT=/^[0-9a-f]{40}$/u,VERSION=/^\d+\.\d+\.\d+$/u;
const MAX_ARCHIVE=512*1024*1024,MAX_TAR=1024*1024*1024,MAX_FILES=50000,MAX_JSON=16*1024*1024;
const sha=b=>createHash('sha256').update(b).digest('hex'),json=x=>Buffer.from(JSON.stringify(x,null,2)+'\n');
function relative(value){
 if(typeof value!=='string'||!value||value.includes('\\')||value.includes(':')||/[\u0000-\u001f\u007f]/u.test(value)||path.posix.normalize(value)!==value||value==='.'||path.posix.isAbsolute(value)||value.split('/').some(x=>x==='..'||/[. ]$/u.test(x)||/^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/iu.test(x)||/^(?:secrets|\.git|\.env(?:\..*)?|\.npmrc|\.git-credentials|credentials\.json|lichess_bot_token\.txt)$/iu.test(x)))throw Error('unsafe release archive path');return value;
}
function fileBytes(filename,max=MAX_JSON){const info=lstatSync(filename);if(!info.isFile()||info.isSymbolicLink()||info.size<1||info.size>max)throw Error('release input is not a bounded regular file');return readFileSync(filename);}
function sourceIdentity(root){
 const git=args=>execFileSync('git',['-C',root,...args],{encoding:'utf8',windowsHide:true,maxBuffer:32*1024*1024}).trim();
 const commit=git(['rev-parse','HEAD']);if(!COMMIT.test(commit)||git(['status','--porcelain']))throw Error('release source must be clean at its exact commit');
 return {commit,tree:sha(Buffer.from(git(['ls-tree','-r','--full-tree','HEAD']),'utf8'))};
}
function outputPath(value,repositoryRoot){
 const output=path.resolve(value);if(existsSync(output))throw Error('release output must not exist');
 let existing=path.dirname(output);while(!existsSync(existing))existing=path.dirname(existing);
 for(let current=existing;;current=path.dirname(current)){if(lstatSync(current).isSymbolicLink())throw Error('release output ancestor cannot be a symlink/junction');if(path.dirname(current)===current)break;}
 const actual=path.resolve(realpathSync(existing),path.relative(existing,output)),repo=realpathSync(repositoryRoot),fold=s=>process.platform==='win32'?s.toLowerCase():s;
 if(fold(actual)===fold(repo)||fold(actual).startsWith(fold(repo+path.sep)))throw Error('release output must be outside source');return actual;
}
function sourceOffer(value){
 if(typeof value!=='string'||value.length>2048||/[\u0000-\u001f]/u.test(value))return false;
 try{const url=new URL(value);return url.protocol==='https:'&&url.hostname.length>0&&!url.username&&!url.password;}catch{return false;}
}
function validateRepository(value){
 if(value?.full_name!==REPOSITORY||!['public','private'].includes(value.visibility)||typeof value.private!=='boolean'||value.private!==(value.visibility==='private'))throw Error('repository visibility/identity metadata differs');return value.visibility;
}
export function validateDraftIntake(release,{version,expectedCommit,expectedArchiveSha256}){
 const name=`uci_arena.vector-${version}-windows-x86_64.tar.gz`;
 if(!VERSION.test(version)||!COMMIT.test(expectedCommit)||!SHA.test(expectedArchiveSha256)||release?.draft!==true||release.target_commitish!==expectedCommit||release.tag_name!==`qualification/vector/v${version}/${expectedCommit}`||!Number.isSafeInteger(release.id)||release.id<1||!Array.isArray(release.assets)||release.assets.length!==1)throw Error('draft intake release identity differs');
 const asset=release.assets[0];if(asset.name!==name||asset.digest!==`sha256:${expectedArchiveSha256}`||!Number.isSafeInteger(asset.id)||asset.id<1||!Number.isSafeInteger(asset.size)||asset.size<1||asset.size>MAX_ARCHIVE)throw Error('draft intake archive asset identity differs');
 return {release_id:release.id,release_tag:release.tag_name,asset_id:asset.id,asset_name:name,asset_size_bytes:asset.size,asset_sha256:expectedArchiveSha256,source_commit:expectedCommit,draft:true};
}
function extractProducerTar(archive,root){
 const tar=gunzipSync(archive,{maxOutputLength:MAX_TAR});if(tar.length%512)throw Error('truncated producer tar');
 const rows=[],names=new Set(),text=b=>new TextDecoder('utf-8',{fatal:true}).decode(b.subarray(0,b.indexOf(0)<0?b.length:b.indexOf(0)));
 const octal=b=>{const s=b.toString('ascii').replace(/\0.*$/su,'').trim();if(!/^[0-7]+$/u.test(s))throw Error('invalid tar numeric field');const n=parseInt(s,8);if(!Number.isSafeInteger(n))throw Error('tar numeric overflow');return n;};
 let offset=0,ended=false;
 while(offset<tar.length){
  const header=tar.subarray(offset,offset+512);if(header.every(x=>x===0)){if(tar.length-offset<1024||!tar.subarray(offset).every(x=>x===0))throw Error('invalid tar terminator');ended=true;break;}
  if(rows.length>=MAX_FILES||header.toString('ascii',257,263)!=='ustar\0'||header[156]!==48)throw Error('unsupported or unbounded producer tar entry');
  const expected=octal(header.subarray(148,156));let checksum=0;for(let i=0;i<512;i++)checksum+=i>=148&&i<156?32:header[i];if(checksum!==expected)throw Error('tar checksum mismatch');
  const prefix=text(header.subarray(345,500)),name=relative((prefix?prefix+'/':'')+text(header.subarray(0,100)));
  if(names.has(name.toLowerCase()))throw Error('duplicate/case-colliding tar entry');names.add(name.toLowerCase());
  const size=octal(header.subarray(124,136)),start=offset+512,end=start+size,next=start+Math.ceil(size/512)*512;
  if(next>tar.length||!tar.subarray(end,next).every(x=>x===0))throw Error('truncated or invalid tar member padding');
  rows.push({name,bytes:tar.subarray(start,end)});offset=next;
 }
 if(!ended||!rows.length)throw Error('empty or unterminated producer tar');
 // Validate all member paths/types before any payload extraction.
 for(const row of rows){const target=path.join(root,...row.name.split('/'));mkdirSync(path.dirname(target),{recursive:true});writeFileSync(target,row.bytes,{flag:'wx'});}
}
function releaseLicenses(root,closure){
 const name='contracts/release-license-inventory.json',bytes=fileBytes(path.join(root,name)),inventory=JSON.parse(bytes);
 const declared=new Map(closure.files.map(x=>[x.path,x.sha256]));if(declared.get(name)!==sha(bytes)||inventory.schema!=='vector_release_license_inventory_v1'||!Array.isArray(inventory.materials)||inventory.materials.length!==6)throw Error('license inventory must cover actual complete payload materials');
 const expected={vector:{commit:closure.vector_commit},node:{version:closure.node_version,sha256:declared.get('bin/node.exe')},model:{checkpoint_sha256:closure.model.checkpoint_sha256,parameters_sha256:closure.model.parameters_sha256},...Object.fromEntries(closure.libraries.map(x=>[x.name,{commit:x.commit,version:x.version}]))};
 const ids=new Set(),notices=new Map();
 for(const material of inventory.materials){
  if(!Object.hasOwn(expected,material.id)||ids.has(material.id)||!isDeepStrictEqual(material.subject,expected[material.id])||typeof material.license_expression!=='string'||!material.license_expression||['NOASSERTION','NONE'].includes(material.license_expression)||!sourceOffer(material.source_offer)||!Array.isArray(material.license_paths)||material.license_paths.length<1||material.license_paths.length>32)throw Error('license material identity or actual notice/source offer is missing');
  ids.add(material.id);const library=closure.libraries.find(x=>x.name===material.id);if(library){const pkg=JSON.parse(fileBytes(path.join(root,relative(library.package_json))));if(typeof pkg.license!=='string'||pkg.license!==material.license_expression)throw Error('library license differs from the exact package metadata');}
  for(const notice of material.license_paths){relative(notice);if(!notice.startsWith('licenses/'))throw Error('release license notice must be an inventoried licenses file');const actual=fileBytes(path.join(root,notice));if(declared.get(notice)!==sha(actual))throw Error('license notice differs from qualified payload');notices.set(notice,{path:notice,sha256:sha(actual),size_bytes:actual.length});}
 }
 const identity={inventory_sha256:sha(bytes),notices:[...notices.values()].sort((a,b)=>a.path.localeCompare(b.path))};
 return {inventory,identity,sha256:sha(json(identity))};
}
export function buildProviderStatement(result){
 if(result?.schema!=='arena_provider_release_result_v1'||!SHA.test(result.artifact_sha256??'')||typeof result.artifact_name!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._+-]*$/u.test(result.artifact_name))throw Error('invalid provider attestation subject');
 return {_type:'https://in-toto.io/Statement/v1',subject:[{name:result.artifact_name,digest:{sha256:result.artifact_sha256}}],predicateType:PROVIDER_PREDICATE_TYPE,predicate:structuredClone(result)};
}
export function verifySignedStatement(bundle,expected){
 // Payload comparison only: the workflow MUST first verify the
 // actual signature, certificate and log proof with the pinned Cosign contract.
 if(bundle?.mediaType!=='application/vnd.dev.sigstore.bundle.v0.3+json'||bundle.dsseEnvelope?.payloadType!=='application/vnd.in-toto+json'||!Array.isArray(bundle.dsseEnvelope.signatures)||bundle.dsseEnvelope.signatures.length!==1)throw Error('invalid verified Sigstore DSSE envelope');
 const encoded=bundle.dsseEnvelope.payload;if(typeof encoded!=='string'||encoded.length>MAX_JSON*2||Buffer.from(encoded,'base64').toString('base64')!==encoded)throw Error('invalid canonical DSSE payload');
 const actual=JSON.parse(Buffer.from(encoded,'base64'));if(!isDeepStrictEqual(actual,expected))throw Error('verified DSSE payload differs from complete provider result');return actual;
}
export function stageVectorRelease(options){
 const {archivePath,expectedArchiveSha256,expectedReceiptSha256,version,expectedCommit,repositoryRoot,workflowIdentity,repositoryMetadata,intakeMetadata,outputDirectory}=options;
 if(!SHA.test(expectedArchiveSha256)||!SHA.test(expectedReceiptSha256)||!VERSION.test(version)||!COMMIT.test(expectedCommit)||typeof workflowIdentity!=='string'||!/^iteathen\/UCI-Arena-Vector\/\.github\/workflows\/component-release\.yml@refs\/heads\/main#\d+\.\d+$/u.test(workflowIdentity))throw Error('release source/workflow/qualification identity is invalid');
 const visibility=validateRepository(repositoryMetadata),intake=validateDraftIntake(intakeMetadata,options),source=sourceIdentity(path.resolve(repositoryRoot));if(source.commit!==expectedCommit)throw Error('checked-out source commit differs from intake');
 const repo=path.resolve(repositoryRoot),output=outputPath(outputDirectory,repo);
 const archive=fileBytes(archivePath,MAX_ARCHIVE);if(path.basename(archivePath)!==intake.asset_name||sha(archive)!==expectedArchiveSha256||archive.length!==intake.asset_size_bytes)throw Error('intake archive bytes differ');
 const work=mkdtempSync(path.join(tmpdir(),'vector-release-verify-'));let stage;
 try{
  extractProducerTar(archive,work);
  const manifest=verifyAtomicComponent(work),closure=JSON.parse(fileBytes(path.join(work,'contracts/runtime-closure.json')));
  if(manifest.component_version!==version||closure.vector_commit!==source.commit)throw Error('qualified payload source/version differs');
  const receiptBytes=fileBytes(path.join(work,relative(closure.qualification.receipt))),receipt=JSON.parse(receiptBytes);if(sha(receiptBytes)!==expectedReceiptSha256||receipt.fixture===true||receipt.includes_fixture===true||receipt.qualified===false||receipt.tests.some(t=>t.fixture===true||t.includes_fixture===true||t.qualified===false))throw Error('release qualification receipt is substituted or includes fixture evidence');
  const licenses=releaseLicenses(work,closure),sbom={spdxVersion:'SPDX-2.3',dataLicense:'CC0-1.0',SPDXID:'SPDXRef-DOCUMENT',name:`uci_arena.vector-${version}`,documentNamespace:`https://uci-arena.example/sbom/uci_arena.vector/${version}/${source.commit}`,creationInfo:{creators:['Tool: Vector release-stage-v1'],created:new Date(Number(execFileSync('git',['-C',repo,'show','-s','--format=%ct','HEAD'],{encoding:'utf8',windowsHide:true}).trim())*1000).toISOString()},packages:licenses.inventory.materials.map(x=>({SPDXID:`SPDXRef-${x.id}`,name:x.id,versionInfo:x.subject.version??(x.id==='vector'?version:x.subject.checkpoint_sha256),filesAnalyzed:false,licenseConcluded:'NOASSERTION',copyrightText:'NOASSERTION',licenseDeclared:x.license_expression,downloadLocation:x.source_offer})),relationships:licenses.inventory.materials.map(x=>({spdxElementId:'SPDXRef-DOCUMENT',relationshipType:'DESCRIBES',relatedSpdxElement:`SPDXRef-${x.id}`}))};
  const result={schema:'arena_provider_release_result_v1',component_id:'uci_arena.vector',component_version:version,target_triple:'windows-x86_64',artifact_name:intake.asset_name,artifact_sha256:expectedArchiveSha256,artifact_size_bytes:archive.length,component_manifest_sha256:sha(fileBytes(path.join(work,'arena-component.json'))),source_repository:REPOSITORY,source_commit:source.commit,source_tree_sha256:source.tree,clean_tree:true,release_authority:'provider_component_only',suite_installer_authority:'iteathen/uci-arena-installer',workflow_identity:workflowIdentity,toolchain_identity:{release_node:process.version,release_platform:process.platform,release_architecture:process.arch,payload_node:closure.node_version,qualification_origin:'existing-exact-runtime-owner-receipt; not issued by release staging'},dependency_lock_identities:{runtime_closure_sha256:sha(fileBytes(path.join(work,'contracts/runtime-closure.json'))),libraries:closure.libraries.map(x=>({name:x.name,version:x.version,commit:x.commit})),model:{checkpoint_sha256:closure.model.checkpoint_sha256,parameters_sha256:closure.model.parameters_sha256}},build_flags:['unchanged-qualified-atomic-archive','no dependency install or runtime rebuild','all existing qualification and inventory gates retained'],sbom_sha256:sha(json(sbom)),licenses_sha256:licenses.sha256,test_receipt_sha256:expectedReceiptSha256,tests:receipt.tests,validation_evidence:{repository_visibility:visibility,intake,qualification_file:closure.qualification.receipt,qualification_issued_here:false,licenses:licenses.identity,sbom}};
  mkdirSync(path.dirname(output),{recursive:true});stage=mkdtempSync(path.join(path.dirname(output),'.vector-provider-stage-'));mkdirSync(path.join(stage,'metadata'));
  writeFileSync(path.join(stage,result.artifact_name),archive,{flag:'wx'});const resultName=result.artifact_name.replace(/\.tar\.gz$/u,'.provider-result.json');writeFileSync(path.join(stage,resultName),json(result),{flag:'wx'});writeFileSync(path.join(stage,'metadata/provider-statement.json'),json(buildProviderStatement(result)),{flag:'wx'});
  // One rename exposes the complete archive/result/statement set; input is untouched.
  renameSync(stage,output);stage=undefined;return {artifactPath:path.join(output,result.artifact_name),resultPath:path.join(output,resultName),bundlePath:path.join(output,result.artifact_name+'.sigstore.json'),statementPath:path.join(output,'metadata/provider-statement.json'),result};
 }finally{rmSync(work,{recursive:true,force:true});if(stage)rmSync(stage,{recursive:true,force:true});}
}
function args(argv){const result={};for(let i=0;i<argv.length;i+=2){if(!argv[i]?.startsWith('--')||argv[i+1]===undefined||Object.hasOwn(result,argv[i].slice(2)))throw Error('invalid or duplicate release argument');result[argv[i].slice(2)]=argv[i+1];}return result;}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const [command,...rest]=process.argv.slice(2),a=args(rest);const allowed={stage:['archive','archive-sha256','qualification-sha256','version','source-commit','source-root','workflow-identity','repository-metadata','intake-metadata','output'],'inspect-intake':['archive-sha256','version','source-commit','repository-metadata','intake-metadata'],'verify-statement':['bundle','statement']}[command];if(!allowed||Object.keys(a).some(key=>!allowed.includes(key))||allowed.some(key=>!Object.hasOwn(a,key)))throw Error('missing or unknown release argument');if(command==='stage'){console.log(JSON.stringify(stageVectorRelease({archivePath:a.archive,expectedArchiveSha256:a['archive-sha256'],expectedReceiptSha256:a['qualification-sha256'],version:a.version,expectedCommit:a['source-commit'],repositoryRoot:a['source-root'],workflowIdentity:a['workflow-identity'],repositoryMetadata:JSON.parse(fileBytes(a['repository-metadata'])),intakeMetadata:JSON.parse(fileBytes(a['intake-metadata'])),outputDirectory:a.output})));}else if(command==='inspect-intake'){console.log(JSON.stringify({repository_visibility:validateRepository(JSON.parse(fileBytes(a['repository-metadata']))),intake:validateDraftIntake(JSON.parse(fileBytes(a['intake-metadata'])),{version:a.version,expectedCommit:a['source-commit'],expectedArchiveSha256:a['archive-sha256']})}));}else{verifySignedStatement(JSON.parse(fileBytes(a.bundle)),JSON.parse(fileBytes(a.statement)));console.log('full verified provider statement matches');}}
 catch(error){console.error('Vector release staging failed: '+error.message);process.exitCode=1;}
}
