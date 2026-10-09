import assert from 'node:assert/strict';
import fs from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {renderInstalledLaunchProfile} from '../tools/installer-integration.mjs';

const renderer = fileURLToPath(new URL('../tools/installer-integration.mjs', import.meta.url));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function addInventoriedFile(f,name,bytes){mkdirSync(path.dirname(path.join(f.root,name)),{recursive:true});writeFileSync(path.join(f.root,name),bytes);f.manifest.files.push({path:name,size_bytes:Buffer.byteLength(bytes),sha256:sha(bytes)});writeFileSync(path.join(f.root,'arena-component.json'),JSON.stringify(f.manifest));}

function fixture(t) {
  const temporary = mkdtempSync(path.join(tmpdir(), 'vector-install-renderer-'));
  const parent=fs.realpathSync(tmpdir()),incarnation=fs.lstatSync(temporary,{bigint:true});
  t.after(()=>{const current=fs.lstatSync(temporary,{bigint:true});assert(current.isDirectory()&&!current.isSymbolicLink());assert.equal(fs.realpathSync(temporary),temporary);assert.equal(path.dirname(temporary),parent);assert(path.basename(temporary).startsWith('vector-install-renderer-'));for(const k of ['dev','ino','birthtimeNs'])assert.equal(current[k],incarnation[k]);rmSync(temporary,{recursive:true});});
  const root = path.join(temporary, 'component');
  const workspace = path.join(temporary, 'provider-data');
  const profile = { schema: 'arena_uci_engine_launch_profile_v1', schema_version: 1,
    component: { id: 'uci_arena.vector', version: '0.1.0', root: '.' },
    engine: { adapter: 'standard_uci_v1', executable: 'bin/node.exe',
      arguments: ['--experimental-ffi', 'dist/uci.mjs'], working_directory: '.' },
    state: 'conservative', enabled: true, uci_options: { Hash: 64 }, expected_runtime: null,
    evidence: {}, knowledge: {}, diagnostics: [] };
  const files = { 'bin/node.exe': 'synthetic-runtime', 'dist/uci.mjs': 'synthetic-program',
    'contracts/uci-engine-launch-profile.json': JSON.stringify(profile) };
  for (const [relative, bytes] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
    writeFileSync(path.join(root, relative), bytes);
  }
  mkdirSync(workspace);
  const manifest = { schema: 'arena_install_component_v1', schema_version: 1,
    component_id: 'uci_arena.vector', component_version: '0.1.0',
    capabilities: ['uci_engine_launch_profile_v1'],
    entrypoints: { uci_engine: 'bin/node.exe', uci_launch_profile: 'contracts/uci-engine-launch-profile.json' },
    files: Object.entries(files).map(([relative, bytes]) => ({ path: relative,
      size_bytes: Buffer.byteLength(bytes), sha256: sha(bytes) })) };
  const context = { schema: 'arena_provider_install_context_v1', schema_version: 1,
    component: { id: 'uci_arena.vector', version: '0.1.0', root }, workspace,
    enabled: true, bindings: {}, locators: {}, locator_details: {} };
  function writeManifest() { writeFileSync(path.join(root, 'arena-component.json'), JSON.stringify(manifest)); }
  function setProfile(mutate) {
    mutate(profile);
    const bytes = JSON.stringify(profile);
    writeFileSync(path.join(root, 'contracts/uci-engine-launch-profile.json'), bytes);
    Object.assign(manifest.files.find(row => row.path === 'contracts/uci-engine-launch-profile.json'),
      { size_bytes: Buffer.byteLength(bytes), sha256: sha(bytes) });
    writeManifest();
  }
  writeManifest();
  function run() {
    const contextFile = path.join(temporary, 'context.json');
    writeFileSync(contextFile, JSON.stringify(context));
    return spawnSync(process.execPath, [renderer, '--context', contextFile],
      { encoding: 'utf8', timeout: 10_000, maxBuffer: 64 * 1024 });
  }
  return { root, workspace, context, profile, manifest, run, setProfile };
}

test('installer renderer emits the absolute Manager launch profile without mutating payload', t => {
  const f = fixture(t);
  const before = readFileSync(path.join(f.root, 'contracts/uci-engine-launch-profile.json'));
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.schema, 'arena_provider_install_result_v1');
  assert.deepEqual(output.generated_documents, []);
  assert.equal(output.configuration.component.root, f.root);
  assert.equal(output.configuration.engine.executable, path.join(f.root, 'bin/node.exe'));
  assert.equal(output.configuration.engine.working_directory, f.root);
  assert.deepEqual(output.configuration.engine.arguments, ['--experimental-ffi', path.join(f.root, 'dist/uci.mjs')]);
  assert.deepEqual(output.configuration.uci_options, { Hash: 64, OwnBook:false, BookSnapshotBinding:'' });
  assert.equal(output.configuration.expected_runtime, null);
  assert.deepEqual(readFileSync(path.join(f.root, 'contracts/uci-engine-launch-profile.json')), before);
});

test('installed unselected Book is disabled rather than using an unrelated environment default',t=>{
 const f=fixture(t),result=f.run();assert.equal(result.status,0,result.stderr);
 const out=JSON.parse(result.stdout);assert.equal(out.configuration.uci_options.OwnBook,false);
 assert.equal(out.configuration.knowledge.opening_book.reason,'no-selected-locator');
});

test('renderer binds explicit personal v2 Book roles and authority without qualifying data',t=>{
 for(const authority_mode of ['immutable_pinned_snapshot','service_managed_live_channel']){
  const f=fixture(t),directory=path.join(f.workspace,'selected-book');mkdirSync(directory);
  for(const name of ['strong_rare_v1.bin','strong_rare_v1.stats','strong_rare_v1.policy'])writeFileSync(path.join(directory,name),'fixture');
  const manifest={schema:'uci_arena_book_snapshot_v2',snapshot_id:'integration-0123456789abcdef0123',channel:'integration',qualified:false,record_count:1,artifacts:Object.fromEntries(['strong_rare_v1.bin','strong_rare_v1.stats','strong_rare_v1.policy'].map(name=>[name,sha('fixture')]))};
  writeFileSync(path.join(directory,'snapshot.manifest.json'),JSON.stringify(manifest));
  f.context.locators.opening_book=directory;f.context.locator_details.opening_book={kind:'opening_book',path:directory,source:'saved_locator',storage_mode:'in_place_reference',authority_mode};
  const result=f.run();assert.equal(result.status,0,result.stderr);const out=JSON.parse(result.stdout);
  assert.equal(out.configuration.uci_options.BookFile,path.join(directory,'strong_rare_v1.bin'));
  assert.equal(out.configuration.uci_options.BookStatsFile,path.join(directory,'strong_rare_v1.stats'));
  assert.equal(out.configuration.uci_options.BookPolicyFile,path.join(directory,'strong_rare_v1.policy'));
  const binding=out.generated_documents.find(row=>row.path==='opening-book-binding.json').document;
  assert.equal(binding.authorityMode,authority_mode);assert.equal(binding.capability,'snapshot_v2');
  assert.equal(binding.pin?.manifestSha256??null,authority_mode==='immutable_pinned_snapshot'?sha(JSON.stringify(manifest)):null);
  assert.equal(out.configuration.knowledge.opening_book.status,'configured-pending-engine-admission');
 }
});

test('component identity mismatch fails before publishing a configuration', t => {
  const f = fixture(t);
  assert.equal(f.run().status, 0);
  f.context.component.version = '0.2.0';
  const result = f.run();
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, '');
});

test('renderer binds the receipt-provided root provider and selected dataset through generated public documents',t=>{
  const f=fixture(t),provider=path.join(f.workspace,'external-provider'),dataset=path.join(f.workspace,'selected-data');mkdirSync(provider);mkdirSync(dataset);
  const contract=JSON.stringify({schema:'uci_arena_root_knowledge_contract_v2',version:'2.1.0'}),manifest=JSON.stringify({schema:'uci_arena_root_provider_package_v1',files:[{path:'contracts/offline-root-knowledge-v2.json',sha256:sha(contract),bytes:Buffer.byteLength(contract)}]});
  mkdirSync(path.join(provider,'contracts'));writeFileSync(path.join(provider,'contracts/offline-root-knowledge-v2.json'),contract);writeFileSync(path.join(provider,'package-manifest.json'),manifest);
  const selection={schema:'vector_root_tablebase_selection_v1',componentId:'syzygy.root-provider',version:'2.1.0',manifestSha256:sha(manifest),contractSha256:sha(contract)};
  addInventoriedFile(f,'contracts/root-tablebase-selection.json',JSON.stringify(selection));
  writeFileSync(path.join(dataset,'syzygy_manifest_v1.json'),JSON.stringify({schema:'uci_arena_syzygy_manifest_v1',files:[{name:'KQvK.rtbw'},{name:'KQvK.rtbz'}]}));
  f.context.bindings.root_tablebase_provider=provider;f.context.locators.syzygy=dataset;f.context.locator_details.syzygy={kind:'syzygy',path:dataset,source:'saved_locator',storage_mode:'external_path'};
  const result=f.run();assert.equal(result.status,0,result.stderr);const out=JSON.parse(result.stdout);assert.equal(out.generated_documents.length,2);
  const cold=out.generated_documents.find(row=>row.path==='root-provider-config.json').document,binding=out.generated_documents.find(row=>row.path==='root-provider-binding.json').document;
  assert.equal(cold.dataset_root,dataset);assert.deepEqual(cold.selected_files,['KQvK.rtbw','KQvK.rtbz']);assert.equal(binding.schema,'vector_root_tablebase_binding_v2');assert.equal(binding.componentRoot,provider);assert.equal(binding.configuration.path,path.join(f.workspace,'root-provider-config.json'));assert.equal(out.configuration.uci_options.RootTablebaseBinding,path.join(f.workspace,'root-provider-binding.json'));
  assert.equal(out.configuration.knowledge.syzygy.status,'configured-pending-provider-admission');
  writeFileSync(path.join(provider,'package-manifest.json'),manifest+' ');assert.notEqual(f.run().status,0);
});

test('renderer resolves only an inventoried timing artifact and exact declared digest',t=>{
  const f=fixture(t),text=JSON.stringify({schema:'vector_timing_policy_v1',interface_fixture:true});addInventoriedFile(f,'contracts/timing-policy.json',text);
  f.setProfile(p=>{p.uci_options.TimingPolicyFile='contracts/timing-policy.json';p.uci_options.TimingPolicySha256=sha(text);p.uci_options.TimingInitialTimeMs=0;});
  const out=f.run();assert.equal(out.status,0,out.stderr);assert.equal(JSON.parse(out.stdout).configuration.uci_options.TimingPolicyFile,path.join(f.root,'contracts/timing-policy.json'));
  f.setProfile(p=>{p.uci_options.TimingPolicySha256='a'.repeat(64);});assert.notEqual(f.run().status,0);
});

test('an inventory-verified document cannot be replaced by different metadata before parsing',t=>{
  const f=fixture(t);
  // Inventory a valid profile, then change the file immediately after its
  // original inventory read. Parsing a second read formerly admitted new options.
  const valid=JSON.stringify({...f.profile,engine:{...f.profile.engine,arguments:['--experimental-ffi','dist/uci.mjs']}}),profilePath=path.join(f.root,'contracts/uci-engine-launch-profile.json');
  writeFileSync(profilePath,valid);Object.assign(f.manifest.files.find(row=>row.path==='contracts/uci-engine-launch-profile.json'),{sha256:sha(valid),size_bytes:Buffer.byteLength(valid)});writeFileSync(path.join(f.root,'arena-component.json'),JSON.stringify(f.manifest));
  const substituted={...JSON.parse(valid),uci_options:{Hash:128}};
  const original=fs.readFileSync;let changed=false;
  fs.readFileSync=function(file,...args){const bytes=original.call(this,file,...args);if(path.resolve(String(file))===profilePath&&!changed){changed=true;writeFileSync(profilePath,JSON.stringify(substituted));}return bytes;};syncBuiltinESMExports();
  try{const result=renderInstalledLaunchProfile(f.context);assert.equal(result.configuration.uci_options.Hash,64);}finally{fs.readFileSync=original;syncBuiltinESMExports();}
});

test('the declared model root is resolved explicitly and never escapes the installed component', t => {
  const f = fixture(t);
  mkdirSync(path.join(f.root, 'models/default'), { recursive: true });
  f.manifest.default_model = { model_id: 'compact_chessformer_gab_v1',
    display_name: 'LatticeKnight-4M', input_adapter_id: 'chess_v1_fen_to_dense_planes_v1', root: 'models/default' };
  f.setProfile(p => { p.uci_options.ModelRoot = 'models/default'; });
  const result = f.run();
  assert.equal(result.status, 0);
  assert.equal(JSON.parse(result.stdout).configuration.uci_options.ModelRoot, path.join(f.root, 'models/default'));
  f.manifest.default_model.root = '../outside';
  f.setProfile(p => { p.uci_options.ModelRoot = '../outside'; });
  assert.notEqual(f.run().status, 0);
});

test('renderer rejects changed or missing executable and program inventory', t => {
  for (const relative of ['bin/node.exe', 'dist/uci.mjs']) {
    const f = fixture(t);
    assert.equal(f.run().status, 0);
    writeFileSync(path.join(f.root, relative), 'changed');
    assert.notEqual(f.run().status, 0);
    rmSync(path.join(f.root, relative));
    assert.notEqual(f.run().status, 0);
  }
});

test('launch flags and multi-line option values cannot inject execution or protocol commands', t => {
  for (const mutate of [p => { p.engine.arguments = ['--eval', 'process.exit(0)']; },
    p => { p.engine.arguments = ['dist/uci.mjs', '--experimental-ffi']; },
    p => { p.engine.arguments = ['../outside.mjs']; },
    p => { p.uci_options.Hash = '64\nquit'; }, p => { p.expected_runtime = { fabricated: true }; }]) {
    const f = fixture(t);
    assert.equal(f.run().status, 0);
    f.setProfile(mutate);
    const result = f.run();
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, '');
  }
});

test('a junction in the program path cannot cross the verified component boundary', t => {
  const f = fixture(t);
  assert.equal(f.run().status, 0);
  const outside = path.join(f.workspace, 'outside');
  mkdirSync(outside);
  writeFileSync(path.join(outside, 'uci.mjs'), 'synthetic-program');
  rmSync(path.join(f.root, 'dist'), { recursive: true });
  symlinkSync(outside, path.join(f.root, 'dist'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.notEqual(f.run().status, 0);
});

test('selected file-only Book binds exact immutable base bytes without inferring v2 neighbors',t=>{
 const f=fixture(t),file=path.join(f.workspace,'selected.book'),bytes=Buffer.alloc(16,1);writeFileSync(file,bytes);writeFileSync(path.join(f.workspace,'snapshot.manifest.json'),'unrelated bad manifest');
 f.context.locators.opening_book=file;f.context.locator_details.opening_book={kind:'opening_book',path:file,source:'saved_locator',storage_mode:'managed_copy',authority_mode:'immutable_pinned_snapshot'};
 const result=f.run();assert.equal(result.status,0,result.stderr);const out=JSON.parse(result.stdout),binding=out.generated_documents[0].document;
 assert.equal(out.configuration.uci_options.OwnBook,true);assert.equal(binding.capability,'polyglot_base');assert.deepEqual(binding.pin,{bookSha256:sha(bytes)});assert.deepEqual(binding.files,{bookFile:file,statsFile:'',policyFile:'',manifestFile:''});assert.equal(out.configuration.uci_options.BookStatsFile,'');assert.equal(out.configuration.uci_options.BookPolicyFile,'');
});
test('unavailable or incompatible optional Book remains degraded and never enables a default',t=>{
 for(const form of ['missing','bad-file','live-file','missing-v2']){
  const f=fixture(t),selected=path.join(f.workspace,form);if(form==='missing-v2')mkdirSync(selected);else if(form!=='missing')writeFileSync(selected,'bad');
  f.context.locators.opening_book=selected;f.context.locator_details.opening_book={kind:'opening_book',path:selected,source:'saved_locator',storage_mode:'in_place_reference',authority_mode:form==='live-file'?'service_managed_live_channel':'immutable_pinned_snapshot'};
  const result=f.run();assert.equal(result.status,0,result.stderr);const out=JSON.parse(result.stdout);assert.equal(out.configuration.uci_options.OwnBook,false);assert.equal(out.configuration.uci_options.BookSnapshotBinding,'');assert.equal(out.generated_documents.length,0);assert.equal(out.configuration.knowledge.opening_book.reason,'selected-book-unavailable-or-incompatible');
 }
});
test('wrong Book locator authority fails closed before publishing consumer configuration',t=>{
 for(const change of [{kind:'syzygy'},{path:path.resolve('different')},{source:'inferred'},{authority_mode:'live'},{storage_mode:'managed_copy',authority_mode:'service_managed_live_channel'}]){
  const f=fixture(t),file=path.join(f.workspace,'selected.bin');writeFileSync(file,Buffer.alloc(16));f.context.locators.opening_book=file;f.context.locator_details.opening_book={kind:'opening_book',path:file,source:'saved_locator',storage_mode:'in_place_reference',authority_mode:'immutable_pinned_snapshot',...change};
  const result=f.run();assert.notEqual(result.status,0);assert.equal(result.stdout,'');
 }
});
