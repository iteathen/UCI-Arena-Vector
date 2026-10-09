// Synthetic metadata fixtures ONLY. These are not native qualification receipts,
// usable engines, licensed models or publishable release candidates.
import assert from 'node:assert/strict';import {test} from 'node:test';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,existsSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';import path from 'node:path';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';import {gunzipSync,gzipSync} from 'node:zlib';
import {buildAtomicComponent} from '../tools/component-package.mjs';
import {stageVectorRelease,validateDraftIntake,buildProviderStatement,verifySignedStatement} from '../tools/release-stage.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex'),json=x=>JSON.stringify(x)+'\n';
function fixture(t){
 const base=mkdtempSync(path.join(tmpdir(),'vector-release-unit-'));t.after(()=>rmSync(base,{recursive:true,force:true}));
 const repo=path.join(base,'source'),root=path.join(base,'runtime');mkdirSync(repo);mkdirSync(root);
 const git=args=>execFileSync('git',['-C',repo,...args],{encoding:'utf8',windowsHide:true}).trim();
 git(['init','--quiet']);git(['config','user.name','Synthetic packaging test']);git(['config','user.email','packaging@example.invalid']);writeFileSync(path.join(repo,'source.txt'),'metadata fixture; not actual Vector');git(['add','source.txt']);git(['commit','--quiet','-m','fixture']);const commit=git(['rev-parse','HEAD']);
 const libraries=['cuda-js','cuda-mcgs','cuda-js-tensor'];
 const files={'bin/node.exe':'synthetic not executable','dist/uci.mjs':'export {};','dist/installer-integration.mjs':'export {};','models/default/parameters.f32.bin':'synthetic parameters','licenses/notices.txt':'synthetic test license; no actual rights or release grant'};
 for(const name of libraries)files[`libraries/${name}/package.json`]=json({version:'0.1.0',license:'LicenseRef-SyntheticUnitFixture'});
 const subjects={vector:{commit},node:{version:'26.11.1',sha256:sha(files['bin/node.exe'])},model:{checkpoint_sha256:'3'.repeat(64),parameters_sha256:sha(files['models/default/parameters.f32.bin'])},...Object.fromEntries(libraries.map(name=>[name,{commit:'2'.repeat(40),version:'0.1.0'}]))};
 files['contracts/release-license-inventory.json']=json({schema:'vector_release_license_inventory_v1',materials:Object.entries(subjects).map(([id,subject])=>({id,subject,license_expression:'LicenseRef-SyntheticUnitFixture',license_paths:['licenses/notices.txt'],source_offer:'https://example.invalid/synthetic-not-release'}))});
 const receipt={schema:'vector_runtime_qualification_v1',status:'pass',vector_commit:commit,tests:['gpu-search','legal-game','clock-safety','lifecycle','tactical-safety'].map(name=>({name,status:'pass',scope:'synthetic-metadata-unit-fixture-only'})),files:Object.entries(files).map(([path,bytes])=>({path,sha256:sha(bytes)}))};
 files['contracts/runtime-qualification.json']=json(receipt);
 for(const [name,bytes]of Object.entries(files)){mkdirSync(path.dirname(path.join(root,name)),{recursive:true});writeFileSync(path.join(root,name),bytes);}
 const closure={schema:'vector_runtime_closure_v1',component_version:'0.1.0',vector_commit:commit,node_version:'26.11.1',files:Object.entries(files).map(([path,bytes])=>({path,sha256:sha(bytes)})),libraries:libraries.map(name=>({name,version:'0.1.0',commit:'2'.repeat(40),package_json:`libraries/${name}/package.json`})),model:{checkpoint_sha256:'3'.repeat(64),parameters:'models/default/parameters.f32.bin',parameters_sha256:sha(files['models/default/parameters.f32.bin'])},qualification:{status:'pass',receipt:'contracts/runtime-qualification.json',receipt_sha256:sha(files['contracts/runtime-qualification.json'])}};
 const archive=buildAtomicComponent({root,closure,version:'0.1.0',sourceDateEpoch:1791489600}).archive,artifact=path.join(base,'uci_arena.vector-0.1.0-windows-x86_64.tar.gz');writeFileSync(artifact,archive);
 const metadata={id:10,draft:true,tag_name:`qualification/vector/v0.1.0/${commit}`,target_commitish:commit,assets:[{id:11,name:path.basename(artifact),size:archive.length,digest:'sha256:'+sha(archive)}]};
 return {base,repo,root,commit,closure,files,archive,artifact,metadata,options:{archivePath:artifact,expectedArchiveSha256:sha(archive),expectedReceiptSha256:closure.qualification.receipt_sha256,version:'0.1.0',expectedCommit:commit,repositoryRoot:repo,workflowIdentity:'iteathen/UCI-Arena-Vector/.github/workflows/component-release.yml@refs/heads/main#123.1',repositoryMetadata:{full_name:'iteathen/UCI-Arena-Vector',visibility:'public',private:false},intakeMetadata:metadata,outputDirectory:path.join(base,'provider'),statementDirectory:path.join(base,'statements')}};
}
test('stage binds the unchanged qualified archive, exact source and complete provider predicate',t=>{
 const q=fixture(t),record=stageVectorRelease(q.options);assert.equal(record.result.artifact_sha256,sha(q.archive));assert.deepEqual(readFileSync(record.artifactPath),q.archive);assert.equal(record.result.source_commit,q.commit);assert.equal(record.result.clean_tree,true);assert.equal(record.result.tests.length,5);assert.equal(record.result.validation_evidence.repository_visibility,'public');assert.deepEqual(JSON.parse(readFileSync(record.statementPath)),buildProviderStatement(record.result));assert.equal(record.result.test_receipt_sha256,q.closure.qualification.receipt_sha256);assert.equal(existsSync(path.join(q.options.outputDirectory,'verified-payload')),false);
 if(process.env.VECTOR_RELEASE_COMPATIBILITY_SNAPSHOT==='1'){mkdirSync('.cache',{recursive:true});writeFileSync('.cache/synthetic-provider-metadata.json',json({scope:'synthetic-metadata-only-not-signature-or-native-proof',result:record.result,archiveBase64:q.archive.toString('base64')}));}
 const original=readFileSync(q.artifact);assert.deepEqual(original,q.archive);assert.throws(()=>stageVectorRelease(q.options),/exist/i);
});
test('draft intake cannot substitute source, archive, repository visibility or multiple assets',t=>{
 const q=fixture(t);assert.doesNotThrow(()=>validateDraftIntake(q.metadata,q.options));
 for(const mutate of [x=>x.draft=false,x=>x.target_commitish='main',x=>x.tag_name='other',x=>x.assets.push({...x.assets[0]}),x=>x.assets[0].digest='sha256:'+'0'.repeat(64),x=>x.assets[0].name='../payload.tar.gz']){const changed=structuredClone(q.metadata);mutate(changed);assert.throws(()=>validateDraftIntake(changed,q.options));}
 assert.throws(()=>stageVectorRelease({...q.options,repositoryMetadata:{full_name:'other/repository',visibility:'public',private:false}}));assert.throws(()=>stageVectorRelease({...q.options,repositoryMetadata:{full_name:'iteathen/UCI-Arena-Vector',visibility:'private',private:false}}));
});
test('changed source, receipt identity, archive bytes and non-main signer fail with no partial provider output',t=>{
 const q=fixture(t);for(const delta of [{expectedCommit:'0'.repeat(40)},{expectedReceiptSha256:'0'.repeat(64)},{expectedArchiveSha256:'0'.repeat(64)},{workflowIdentity:'iteathen/UCI-Arena-Vector/.github/workflows/component-release.yml@refs/heads/other#123.1'}]){assert.throws(()=>stageVectorRelease({...q.options,...delta}));assert(!existsSync(q.options.outputDirectory));}
 writeFileSync(path.join(q.repo,'source.txt'),'changed');assert.throws(()=>stageVectorRelease(q.options),/clean|source/);assert(!existsSync(q.options.outputDirectory));
});
test('an output alias into the source checkout cannot falsify clean-tree authority',t=>{
 const q=fixture(t),alias=path.join(q.base,'source-alias');symlinkSync(q.repo,alias,process.platform==='win32'?'junction':'dir');
 assert.throws(()=>stageVectorRelease({...q.options,outputDirectory:path.join(alias,'provider')}),/source|symlink|junction/);assert(!existsSync(path.join(q.repo,'provider')));
});
function rebuilt(q,mutate){const receipt=JSON.parse(q.files['contracts/runtime-qualification.json']);mutate(receipt,q.closure,q.files);q.files['contracts/runtime-qualification.json']=json(receipt);writeFileSync(path.join(q.root,'contracts/runtime-qualification.json'),q.files['contracts/runtime-qualification.json']);q.closure.qualification.receipt_sha256=sha(q.files['contracts/runtime-qualification.json']);q.closure.files.find(x=>x.path==='contracts/runtime-qualification.json').sha256=q.closure.qualification.receipt_sha256;return buildAtomicComponent({root:q.root,closure:q.closure,version:'0.1.0',sourceDateEpoch:1791489600});}
test('all five native owner gates stay mandatory; explicit fixture input cannot become a release',t=>{
 for(const name of ['gpu-search','legal-game','clock-safety','lifecycle','tactical-safety']){const q=fixture(t);assert.throws(()=>rebuilt(q,r=>r.tests=r.tests.filter(x=>x.name!==name)),/qualification/);}
 const q=fixture(t),built=rebuilt(q,r=>r.includes_fixture=true);writeFileSync(q.artifact,built.archive);const options={...q.options,expectedArchiveSha256:sha(built.archive),expectedReceiptSha256:q.closure.qualification.receipt_sha256,intakeMetadata:{...q.metadata,assets:[{...q.metadata.assets[0],size:built.archive.length,digest:'sha256:'+sha(built.archive)}]}};assert.throws(()=>stageVectorRelease(options),/fixture|qualification/);assert(!existsSync(q.options.outputDirectory));
});
test('unsafe tar member, duplicate member and checksum corruption fail before extraction/output',t=>{
 const q=fixture(t),raw=gunzipSync(q.archive);for(const bad of ['../outside','bin/node.exe']){const copy=Buffer.from(raw);copy.fill(0,0,100);copy.write(bad,0);copy.fill(32,148,156);copy.write(copy.subarray(0,512).reduce((a,b)=>a+b,0).toString(8).padStart(6,'0'),148,6);copy[154]=0;const archive=gzipSync(copy);writeFileSync(q.artifact,archive);const options={...q.options,expectedArchiveSha256:sha(archive),intakeMetadata:{...q.metadata,assets:[{...q.metadata.assets[0],size:archive.length,digest:'sha256:'+sha(archive)}]}};assert.throws(()=>stageVectorRelease(options));assert(!existsSync(q.options.outputDirectory));}
 const corrupted=Buffer.from(raw);corrupted[1]^=1;const archive=gzipSync(corrupted);writeFileSync(q.artifact,archive);assert.throws(()=>stageVectorRelease({...q.options,expectedArchiveSha256:sha(archive),intakeMetadata:{...q.metadata,assets:[{...q.metadata.assets[0],size:archive.length,digest:'sha256:'+sha(archive)}]}}));
});
test('qualified license inventory cannot substitute a model/library subject or omit actual notices',t=>{
 for(const mutate of [x=>x.materials=x.materials.filter(m=>m.id!=='model'),x=>x.materials.find(m=>m.id==='model').subject.parameters_sha256='0'.repeat(64),x=>x.materials.find(m=>m.id==='cuda-js').license_expression='different',x=>x.materials.find(m=>m.id==='node').license_paths=['licenses/missing.txt'],x=>x.materials.find(m=>m.id==='node').source_offer='https://synthetic-user:synthetic-not-a-credential@example.invalid/source']){
  const q=fixture(t),name='contracts/release-license-inventory.json',inventory=JSON.parse(q.files[name]);mutate(inventory);q.files[name]=json(inventory);writeFileSync(path.join(q.root,name),q.files[name]);q.closure.files.find(x=>x.path===name).sha256=sha(q.files[name]);
  const built=rebuilt(q,r=>r.files.find(x=>x.path===name).sha256=sha(q.files[name]));writeFileSync(q.artifact,built.archive);
  assert.throws(()=>stageVectorRelease({...q.options,expectedArchiveSha256:sha(built.archive),expectedReceiptSha256:q.closure.qualification.receipt_sha256,intakeMetadata:{...q.metadata,assets:[{...q.metadata.assets[0],size:built.archive.length,digest:'sha256:'+sha(built.archive)}]}}),/license|file/i);assert(!existsSync(q.options.outputDirectory));
 }
});
test('complete signed DSSE statement cannot omit or change a provider result field',()=>{
 const result={schema:'arena_provider_release_result_v1',artifact_name:'payload.tar.gz',artifact_sha256:'1'.repeat(64),tests:[{name:'x',status:'pass'}]};const statement=buildProviderStatement(result),bundle={mediaType:'application/vnd.dev.sigstore.bundle.v0.3+json',dsseEnvelope:{payloadType:'application/vnd.in-toto+json',payload:Buffer.from(json(statement)).toString('base64'),signatures:[{sig:'synthetic; cryptography verified by Cosign separately'}]}};assert.doesNotThrow(()=>verifySignedStatement(bundle,statement));const changed=structuredClone(statement);changed.predicate.tests=[];assert.throws(()=>verifySignedStatement(bundle,changed));
});
