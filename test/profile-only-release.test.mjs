import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync, existsSync,cpSync,mkdtempSync,writeFileSync,lstatSync,realpathSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {admitPriorRuntimeAdmission, assertMaintainedRuntimeSource,profileOnlyReleaseMetadata, PRIOR_013} from '../tools/profile-only-release.mjs';
import {buildAtomicComponent,verifyAtomicComponent,deriveProfileOnlyOverlay} from '../tools/component-package.mjs';
import {stageVectorRelease} from '../tools/release-stage.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
function owned(t){
 const parent=realpathSync(tmpdir()),root=mkdtempSync(path.join(parent,'vector-profile-overlay-')),identity=lstatSync(root,{bigint:true});
 t.after(()=>{const current=lstatSync(root,{bigint:true});assert(current.isDirectory()&&!current.isSymbolicLink());assert.equal(realpathSync(root),root);assert.equal(path.dirname(root),parent);assert(path.basename(root).startsWith('vector-profile-overlay-'));for(const key of ['dev','ino','birthtimeNs'])assert.equal(current[key],identity[key]);rmSync(root,{recursive:true});});return root;
}

test('profile-only admission rejects invented success and unknown original lineage before payload access',()=>{
  for(const record of [{}, {schema:'vector_013_runtime_admission_v1',status:'pass'},
    {schema:'vector_013_runtime_admission_v1',validation_mode:'fixture',verified:{component_version:'0.1.3'}}])
    assert.throws(()=>admitPriorRuntimeAdmission({recordBytes:Buffer.from(JSON.stringify(record)),inputs:{}}));
  assert.equal(PRIOR_013.version,'0.1.3');assert.equal(PRIOR_013.runtimeCommit,'31d5873b47ea5d0bcf6a83728902d3a383787f6f');
});
test('maintained source rejects changed runtime or a noncommit release identity',()=>{
  assert.throws(()=>assertMaintainedRuntimeSource({repositoryRoot:'.',releaseCommit:'not-a-commit'}));
});
test('actual official prior input record and original bytes admit; substituted proof or assets reject',t=>{
  const proof=process.env.VECTOR_014_PRIOR_ADMISSION,root=process.env.VECTOR_014_PRIOR_CANDIDATE;
  if(!proof||!root||!existsSync(proof)){t.skip('requires external actual official 0.1.3 admission and original candidate');return;}
  const recordBytes=readFileSync(proof),record=JSON.parse(recordBytes),inputs=Object.fromEntries(record.assets.map(row=>[row.name,readFileSync(`${root}/${row.name}`)]));
  const accepted=admitPriorRuntimeAdmission({recordBytes,inputs});assert.equal(accepted.runtime_source_commit,PRIOR_013.runtimeCommit);
  for(const mutate of [v=>v.validation_mode='fixture',v=>v.verified.source_commit='1'.repeat(40),v=>v.verified.artifact.sha256='1'.repeat(64),
    v=>v.original_verification_record_sha256='1'.repeat(64),v=>v.extra='unsupported']){
    const changed=structuredClone(record);mutate(changed);assert.throws(()=>admitPriorRuntimeAdmission({recordBytes:Buffer.from(JSON.stringify(changed)),inputs}));
  }
  for(const name of Object.keys(inputs))assert.throws(()=>admitPriorRuntimeAdmission({recordBytes,inputs:{...inputs,[name]:Buffer.from('substituted')}}));
});
const historical014Source='4462a469ff69aceb8b2c7827de0498e67bf2b7e3';
test('maintained runtime proof uses historical clean 0.1.4 Git tree, rejects dirty and committed runtime drift',t=>{
 try{execFileSync('git',['cat-file','-e',`${PRIOR_013.runtimeCommit}^{commit}`],{stdio:'pipe'});}catch{t.skip('historical qualified source object unavailable in shallow checkout');return;}
 const base=owned(t),repo=path.join(base,'source');execFileSync('git',['clone','--quiet','--shared','--no-hardlinks','.',repo],{windowsHide:true});
 const git=args=>execFileSync('git',['-C',repo,...args],{encoding:'utf8',windowsHide:true}).trim();
 assert.throws(()=>assertMaintainedRuntimeSource({repositoryRoot:repo,releaseCommit:git(['rev-parse','HEAD'])}),'Current semantic repair cannot be promoted through the historical overlay');
 try{git(['cat-file','-e',historical014Source+'^{commit}']);}catch{t.skip('historical 0.1.4 source object unavailable in shallow checkout');return;}
 git(['checkout','--quiet','--detach',historical014Source]);const releaseCommit=git(['rev-parse','HEAD']);
 assert.equal(assertMaintainedRuntimeSource({repositoryRoot:repo,releaseCommit}).runtime_source_commit,PRIOR_013.runtimeCommit);
 const file=path.join(repo,'components/evidence-runtime/contract.mjs');writeFileSync(file,readFileSync(file,'utf8')+'\n// owned source-drift falsifier\n');
 assert.throws(()=>assertMaintainedRuntimeSource({repositoryRoot:repo,releaseCommit}));
 git(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-am','owned runtime drift']);
 assert.throws(()=>assertMaintainedRuntimeSource({repositoryRoot:repo,releaseCommit:git(['rev-parse','HEAD'])}));
});
test('actual prior atomic input permits only bounded metadata overlay and retains original receipt/identity',t=>{
 const proof=process.env.VECTOR_014_PRIOR_ADMISSION,candidate=process.env.VECTOR_014_PRIOR_CANDIDATE,priorRoot=process.env.VECTOR_014_PRIOR_PAYLOAD;
 if(!proof||!candidate||!priorRoot){t.skip('requires externally verified original 0.1.3 atomic payload');return;}
 const base=owned(t),repo=path.join(base,'source');execFileSync('git',['clone','--quiet','--shared','--no-hardlinks','.',repo],{windowsHide:true});
 execFileSync('git',['-C',repo,'checkout','--quiet','--detach',historical014Source],{windowsHide:true});
 const releaseCommit=execFileSync('git',['-C',repo,'rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim(),recordBytes=readFileSync(proof),record=JSON.parse(recordBytes),inputs=Object.fromEntries(record.assets.map(row=>[row.name,readFileSync(path.join(candidate,row.name))]));
 const plan=deriveProfileOnlyOverlay({priorRoot,admissionBytes:recordBytes,priorInputs:inputs,repositoryRoot:repo,releaseCommit}),root=path.join(base,'payload');cpSync(priorRoot,root,{recursive:true});
 for(const row of plan.metadataFiles)writeFileSync(path.join(root,row.path),row.bytes);
 const built=buildAtomicComponent({root,closure:plan.closure,version:'0.1.4',sourceDateEpoch:1791700000});
 assert.equal(built.manifest.component_version,'0.1.4');assert.equal(built.profile.state,'conservative');assert.equal(built.profile.expected_runtime,null);assert.equal(built.profile.uci_options.TimingInitialTimeMs,0);
 assert.deepEqual(built.profile.clock_option_bindings,{schema:'arena_uci_clock_option_bindings_v1',schema_version:1,bindings:{TimingInitialTimeMs:'initial_ms'}});
 for(const name of ['contracts/runtime-qualification.json','contracts/runtime-identity.json','contracts/timing-policy.json','dist/uci.mjs','dist/installer-integration.mjs'])assert.deepEqual(readFileSync(path.join(root,name)),readFileSync(path.join(priorRoot,name)));
 const cleanClosure=structuredClone(plan.closure);
 for(const mutate of [v=>v.vector_commit='1'.repeat(40),v=>v.profile_only_release.extra=true,v=>v.libraries[0].commit='1'.repeat(40),v=>v.qualification.receipt_sha256='1'.repeat(64),v=>v.profile_only_release.prior_component_version='0.1.2']){
  const changed=structuredClone(cleanClosure);mutate(changed);assert.throws(()=>buildAtomicComponent({root,closure:changed,sourceDateEpoch:1791700000}));
 }
 for(const name of ['dist/uci.mjs','contracts/runtime-qualification.json','contracts/prior-runtime-admission.json','contracts/prior-runtime-manifest.json']){
  const file=path.join(root,name),original=readFileSync(file),changed=Buffer.concat([original,Buffer.from('\n')]);writeFileSync(file,changed);
  const changedClosure=structuredClone(cleanClosure);changedClosure.files.find(row=>row.path===name).sha256=sha(changed);
  assert.throws(()=>buildAtomicComponent({root,closure:changedClosure,sourceDateEpoch:1791700000}));writeFileSync(file,original);
 }
 assert.equal(verifyAtomicComponent(root).component_version,'0.1.4');
 const manifestFile=path.join(root,'arena-component.json'),profileFile=path.join(root,'contracts/uci-engine-launch-profile.json'),originalManifest=readFileSync(manifestFile),originalProfile=readFileSync(profileFile);
 for(const mutate of [p=>p.enabled=false,p=>p.state='qualified_timing',p=>p.uci_options.OwnBook=false,p=>p.clock_option_bindings.bindings.TimingInitialTimeMs='increment_ms']){
  const profile=JSON.parse(originalProfile);mutate(profile);const changed=Buffer.from(JSON.stringify(profile));writeFileSync(profileFile,changed);
  const manifest=JSON.parse(originalManifest),row=manifest.files.find(x=>x.path==='contracts/uci-engine-launch-profile.json');row.sha256=sha(changed);row.size_bytes=changed.length;writeFileSync(manifestFile,JSON.stringify(manifest));
  assert.throws(()=>verifyAtomicComponent(root));writeFileSync(profileFile,originalProfile);writeFileSync(manifestFile,originalManifest);
 }
 const changedManifest=JSON.parse(originalManifest);changedManifest.startup={invented:true};writeFileSync(manifestFile,JSON.stringify(changedManifest));assert.throws(()=>verifyAtomicComponent(root));writeFileSync(manifestFile,originalManifest);
 // Pure release staging only: no signature issuance, engine invocation or
 // publication. Its metadata must state original runtime and current source.
 const artifact=path.join(base,'uci_arena.vector-0.1.4-windows-x86_64.tar.gz');writeFileSync(artifact,built.archive);
 const output=stageVectorRelease({archivePath:artifact,expectedArchiveSha256:built.artifact_sha256,expectedReceiptSha256:PRIOR_013.qualificationSha256,version:'0.1.4',expectedCommit:releaseCommit,repositoryRoot:repo,
  workflowIdentity:'iteathen/UCI-Arena-Vector/.github/workflows/component-release.yml@refs/heads/main#1.1',repositoryMetadata:{full_name:'iteathen/UCI-Arena-Vector',visibility:'public',private:false},
  intakeMetadata:{id:1,draft:true,tag_name:`qualification/vector/v0.1.4/${releaseCommit}`,target_commitish:releaseCommit,assets:[{id:2,name:path.basename(artifact),size:built.archive.length,digest:`sha256:${built.artifact_sha256}`}]},outputDirectory:path.join(base,'provider')});
 assert.equal(output.result.source_commit,releaseCommit);assert.equal(output.result.validation_evidence.profile_only_runtime.runtime_source_commit,PRIOR_013.runtimeCommit);
 assert.equal(output.result.test_receipt_sha256,PRIOR_013.qualificationSha256);
 assert.equal(output.result.validation_evidence.profile_only_runtime.qualification_issued_here,false);
});
