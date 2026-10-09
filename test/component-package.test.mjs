import fs from 'node:fs';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { test } from 'node:test';
import { buildAtomicComponent, verifyAtomicComponent } from '../tools/component-package.mjs';
import { buildRuntimeContract } from '../components/evidence-runtime/contract.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'vector-component-'));
  const parent=fs.realpathSync(tmpdir()),incarnation=fs.lstatSync(root,{bigint:true});
  t.after(()=>{const current=fs.lstatSync(root,{bigint:true});assert(current.isDirectory()&&!current.isSymbolicLink());assert.equal(fs.realpathSync(root),root);assert.equal(path.dirname(root),parent);assert(path.basename(root).startsWith('vector-component-'));for(const k of ['dev','ino','birthtimeNs'])assert.equal(current[k],incarnation[k]);rmSync(root,{recursive:true});});
  const files = { 'bin/node.exe': 'official-node-fixture', 'dist/uci.mjs': 'export {}',
    'dist/installer-integration.mjs': 'export {}',
    'models/default/parameters.f32.bin': 'model-fixture', 'libraries/cuda-js/package.json': '{"version":"0.1.0-alpha.22"}',
    'libraries/cuda-mcgs/package.json': '{"version":"0.1.0"}',
    'libraries/cuda-js-tensor/package.json': '{"version":"0.1.0-alpha.10"}' };
  files['contracts/runtime-qualification.json'] = JSON.stringify({ schema: 'vector_runtime_qualification_v1',
    status: 'pass', vector_commit: '1'.repeat(40),
    tests: ['gpu-search', 'legal-game', 'clock-safety', 'lifecycle', 'tactical-safety'].map(name => ({ name, status: 'pass' })),
    files: Object.entries(files).map(([relative, bytes]) => ({ path: relative, sha256: sha(bytes) })) });
  for (const [relative, bytes] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
    writeFileSync(path.join(root, relative), bytes);
  }
  const closure = { schema: 'vector_runtime_closure_v1', component_version: '0.1.0',
    vector_commit: '1'.repeat(40), node_version: '26.11.1',
    files: Object.entries(files).map(([relative, bytes]) => ({ path: relative, sha256: sha(bytes) })),
    libraries: ['cuda-js', 'cuda-mcgs', 'cuda-js-tensor'].map(name => ({ name,
      version: JSON.parse(files[`libraries/${name}/package.json`]).version,
      commit: '2'.repeat(40), package_json: `libraries/${name}/package.json` })),
    model: { checkpoint_sha256: '3'.repeat(64), parameters: 'models/default/parameters.f32.bin',
      parameters_sha256: sha(files['models/default/parameters.f32.bin']) },
    qualification: { status: 'pass', receipt: 'contracts/runtime-qualification.json',
      receipt_sha256: sha(files['contracts/runtime-qualification.json']) } };
  return { root, closure, version: '0.1.0', sourceDateEpoch: 1791489600 };
}

test('optional Evidence capability is published only for a qualified inventoried runtime contract', t => {
  const options = fixture(t);
  const contract = buildRuntimeContract({ componentVersion: options.version, targetTriple: 'windows-x86_64' });
  const added = {
    'contracts/evidence-runtime-contract.json': JSON.stringify(contract),
    'contracts/runtime-identity.json': JSON.stringify({ schema: 'vector_engine_runtime_identity_v1', nodeVersion: '26.11.1' }),
    'components/evidence-runtime/cli.mjs': 'export {}',
    'components/evidence-runtime/referee.mjs': 'export {}',
    'components/evidence-runtime/parameters.schema.json': JSON.stringify({ type: 'object', properties: {}, required: [], additionalProperties: false }),
  };
  for (const [relative, bytes] of Object.entries(added)) {
    mkdirSync(path.dirname(path.join(options.root, relative)), { recursive: true });
    writeFileSync(path.join(options.root, relative), bytes);
    options.closure.files.push({ path: relative, sha256: sha(bytes) });
  }
  const receiptPath = path.join(options.root, options.closure.qualification.receipt);
  const receipt = JSON.parse(readFileSync(receiptPath));
  receipt.files.push(...Object.entries(added).map(([relative, bytes]) => ({ path: relative, sha256: sha(bytes) })));
  const receiptBytes = JSON.stringify(receipt); writeFileSync(receiptPath, receiptBytes);
  options.closure.qualification.receipt_sha256 = sha(receiptBytes);
  options.closure.files.find(row => row.path === options.closure.qualification.receipt).sha256 = sha(receiptBytes);
  const first = buildAtomicComponent(options);
  assert.equal(first.manifest.entrypoints.evidence_runtime_contract, 'contracts/evidence-runtime-contract.json');
  assert(first.manifest.capabilities.includes('evidence_runtime_contract_v2'));
  const manifestPath = path.join(options.root, 'arena-component.json');
  const manifest = JSON.parse(readFileSync(manifestPath));
  delete manifest.entrypoints.evidence_runtime_contract;writeFileSync(manifestPath, JSON.stringify(manifest));
  assert.throws(() => verifyAtomicComponent(options.root), /Evidence|runtime contract/);
});

test('one atomic payload inventories the whole runtime and has reproducible bytes', t => {
  const options = fixture(t);
  const first = buildAtomicComponent(options);
  const second = buildAtomicComponent(options);
  assert.deepEqual(first.archive, second.archive);
  assert.equal(first.manifest.component_id, 'uci_arena.vector');
  assert.equal(first.manifest.entrypoints.uci_engine, 'bin/node.exe');
  assert.deepEqual(first.profile.engine.arguments, ['--experimental-ffi', 'dist/uci.mjs']);
  assert.equal(first.profile.uci_options.ModelRoot, 'models/default');
  assert.equal(first.manifest.default_model.root, 'models/default');
  assert.equal(first.manifest.default_model.input_adapter_id, 'chess_v1_fen_to_dense_planes_v1');
  assert.equal(first.manifest.files.length, options.closure.files.length + 2);
  assert.equal(gunzipSync(first.archive).length % 512, 0);
  assert.equal(verifyAtomicComponent(options.root).component_version, '0.1.0');
});

test('an inventoried external root selection adds only declared optional provider and dataset bindings',t=>{
  const options=fixture(t),name='contracts/root-tablebase-selection.json',bytes=JSON.stringify({schema:'vector_root_tablebase_selection_v1',componentId:'syzygy.root-provider',version:'2.1.0',manifestSha256:'a'.repeat(64),contractSha256:'b'.repeat(64)});
  writeFileSync(path.join(options.root,name),bytes);options.closure.files.push({path:name,sha256:sha(bytes)});
  const receiptPath=path.join(options.root,options.closure.qualification.receipt),receipt=JSON.parse(readFileSync(receiptPath));receipt.files.push({path:name,sha256:sha(bytes)});const receiptBytes=JSON.stringify(receipt);writeFileSync(receiptPath,receiptBytes);options.closure.qualification.receipt_sha256=sha(receiptBytes);options.closure.files.find(row=>row.path===options.closure.qualification.receipt).sha256=sha(receiptBytes);
  const {manifest}=buildAtomicComponent(options);assert.deepEqual(manifest.installer_integration.dependency_bindings,[{name:'root_tablebase_provider',component_id:'syzygy.root-provider',source:'component_path',path:'runtime',required:false}]);assert.deepEqual(manifest.installer_integration.locator_bindings,[{name:'opening_book',kind:'opening_book',required:false,accepted_sources:['saved_locator','install_receipt']},{name:'syzygy',kind:'syzygy',required:false}]);
  assert.deepEqual(manifest.dependencies,['node_runtime.private'],'component dependencies are required string ids; optional provider belongs only in its declared binding');assert.equal(verifyAtomicComponent(options.root).component_version,options.version);
  manifest.dependencies.push({component_id:'syzygy.root-provider',required:false,binding:'optional-root-knowledge'});
  writeFileSync(path.join(options.root,'arena-component.json'),JSON.stringify(manifest));
  assert.throws(()=>verifyAtomicComponent(options.root),/installer integration/,'unsupported dependency objects cannot re-enter the accepted string-only component format');
});

test('bundled timing declarations require exact runtime compatibility before launch projection',t=>{
  const options=fixture(t),identity={schema:'vector_engine_runtime_identity_v1',vectorRevision:options.closure.vector_commit,nodeVersion:'26.11.1'};
  // Logical declarations only, with the enclosing synthetic package fixture.
  // This test does not create native evidence or a signed candidate.
  const policy={schema:'vector_timing_policy_v1',producer:'vector-evidence-runtime/clock-allocation-v1',runtime_identity_sha256:sha(JSON.stringify(identity)),control:{initial_time_ms:180000,increment_ms:3000},strategy:{kind:'target_blocks_v1',target_blocks:1},useful_blocks_ms:[500],local_publication_reserve_ms:100,unsupported_fallback:'publish-current',qualification:{status:'qualified',study_sha256:'a'.repeat(64),discovery_sha256:'b'.repeat(64),held_out_sha256:'c'.repeat(64),reserve_sha256:'d'.repeat(64),allocation:true,useful_blocks:true,clock_safety:true,discovery:{opening_units:8,mean_score_gain:.25,directional_p:1/256},held_out:{opening_units:8,mean_score_gain:.25,directional_p:1/256}}};
  for(const [name,bytes]of Object.entries({'contracts/runtime-identity.json':JSON.stringify(identity),'contracts/timing-policy.json':JSON.stringify(policy)})){writeFileSync(path.join(options.root,name),bytes);options.closure.files.push({path:name,sha256:sha(bytes)});}
  const receiptPath=path.join(options.root,options.closure.qualification.receipt),receipt=JSON.parse(readFileSync(receiptPath));receipt.files=options.closure.files.filter(row=>row.path!==options.closure.qualification.receipt).map(row=>({...row}));const bytes=JSON.stringify(receipt);writeFileSync(receiptPath,bytes);options.closure.qualification.receipt_sha256=sha(bytes);options.closure.files.find(row=>row.path===options.closure.qualification.receipt).sha256=sha(bytes);
  const built=buildAtomicComponent(options);assert.equal(built.profile.uci_options.TimingPolicyFile,'contracts/timing-policy.json');assert.equal(built.profile.uci_options.TimingPolicySha256,sha(JSON.stringify(policy)));assert.equal(built.profile.uci_options.TimingInitialTimeMs,0);
  const profilePath='contracts/uci-engine-launch-profile.json',profile=JSON.parse(readFileSync(path.join(options.root,profilePath)));profile.uci_options.TimingPolicySha256='e'.repeat(64);const changed=JSON.stringify(profile);writeFileSync(path.join(options.root,profilePath),changed);const manifest=JSON.parse(readFileSync(path.join(options.root,'arena-component.json')));Object.assign(manifest.files.find(row=>row.path===profilePath),{sha256:sha(changed),size_bytes:Buffer.byteLength(changed)});writeFileSync(path.join(options.root,'arena-component.json'),JSON.stringify(manifest));
  assert.throws(()=>verifyAtomicComponent(options.root));
});

test('managed discovery can resolve the script launch through preserved provider configuration', t => {
  const options = fixture(t);
  const { manifest } = buildAtomicComponent(options);
  assert.ok(manifest.capabilities.includes('uci_engine_launch_profile_v1'),
    'Manager requires the declared launch-profile capability to load argv');
  assert.equal(manifest.entrypoints.installer_integration, 'dist/installer-integration.mjs');
  assert.ok(manifest.files.some(row => row.path === manifest.entrypoints.installer_integration));
  assert.ok(manifest.dependencies.includes('node_runtime.private'));
  assert.equal(manifest.installer_integration.schema, 'arena_provider_installer_integration_v1');
  assert.equal(manifest.installer_integration.workspace_placement, 'product_data');
  assert.equal(manifest.workspace_name, manifest.installer_integration.workspace_name);
  assert.deepEqual(manifest.installer_integration.arguments, ['--context']);
});

test('verification rejects missing managed launch routing before the component is admitted', t => {
  for (const mutate of [m => { m.capabilities = ['uci_engine']; },
    m => { delete m.installer_integration; },
    m => { m.installer_integration.invocation.runtime_component_id = 'wrong.runtime'; },
    m => { m.installer_integration.workspace_name = 'different'; },
    m => { m.entrypoints.installer_integration = 'dist/uci.mjs'; }]) {
    const options = fixture(t);
    const { manifest } = buildAtomicComponent(options);
    mutate(manifest);
    writeFileSync(path.join(options.root, 'arena-component.json'), JSON.stringify(manifest));
    assert.throws(() => verifyAtomicComponent(options.root), /launch|integration/);
  }
});

test('changed entry program, model, dependency and extra file fail exact closure admission', t => {
  for (const relative of ['dist/uci.mjs', 'models/default/parameters.f32.bin', 'libraries/cuda-js/package.json', 'extra.mjs']) {
    const options = fixture(t);
    writeFileSync(path.join(options.root, relative), 'tampered');
    assert.throws(() => buildAtomicComponent(options), /closure|identity/);
  }
});

test('installed component verification detects transitive source tampering and missing assets', t => {
  const options = fixture(t);
  buildAtomicComponent(options);
  writeFileSync(path.join(options.root, 'libraries/cuda-js/package.json'), '{}');
  assert.throws(() => verifyAtomicComponent(options.root), /identity/);
  rmSync(path.join(options.root, 'models/default/parameters.f32.bin'));
  assert.throws(() => verifyAtomicComponent(options.root));
});

test('unqualified, mixed-version, traversal and duplicate closures fail before packaging', t => {
  for (const mutate of [c => { c.qualification.status = 'pending'; }, c => { c.component_version = '0.2.0'; },
    c => { c.libraries[0].version = '0.0.0'; }, c => { c.files[0].path = '../outside'; },
    c => { c.files.push({ ...c.files[0] }); }, c => { c.files[0].path = 'bin/NODE.exe'; }]) {
    const options = fixture(t);
    mutate(options.closure);
    assert.throws(() => buildAtomicComponent(options));
    assert.throws(() => readFileSync(path.join(options.root, 'arena-component.json')));
  }
});

test('symlink payload cannot grant files outside the atomic component', t => {
  const options = fixture(t);
  symlinkSync(path.join(options.root, 'libraries'), path.join(options.root, 'alias'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => buildAtomicComponent(options), /link|reparse/);
});

test('qualification receipt must pass required gates against these exact runtime bytes', t => {
  for (const mutate of [r => { r.tests[1].status = 'pending'; },
    r => { r.vector_commit = '5'.repeat(40); }, r => { r.files[0].sha256 = '6'.repeat(64); },
    r => { r.tests.pop(); }]) {
    const options = fixture(t);
    const filename = path.join(options.root, options.closure.qualification.receipt);
    const receipt = JSON.parse(readFileSync(filename));
    mutate(receipt);
    const bytes = JSON.stringify(receipt);
    writeFileSync(filename, bytes);
    options.closure.qualification.receipt_sha256 = sha(bytes);
    options.closure.files.find(row => row.path === options.closure.qualification.receipt).sha256 = sha(bytes);
    assert.throws(() => buildAtomicComponent(options), /qualification/);
  }
});

test('Book locator is optional independently of root tablebase component selection',t=>{
 const options=fixture(t),out=buildAtomicComponent(options);
 assert.deepEqual(out.manifest.dependencies,['node_runtime.private']);
 assert.deepEqual(out.manifest.installer_integration.locator_bindings,[{name:'opening_book',kind:'opening_book',required:false,accepted_sources:['saved_locator','install_receipt']}]);
 const manifestPath=path.join(options.root,'arena-component.json'),manifest=JSON.parse(readFileSync(manifestPath));manifest.installer_integration.locator_bindings[0].required=true;writeFileSync(manifestPath,JSON.stringify(manifest));assert.throws(()=>verifyAtomicComponent(options.root),/installer integration/i);
});
