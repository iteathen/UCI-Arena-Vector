import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const renderer = fileURLToPath(new URL('../tools/installer-integration.mjs', import.meta.url));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

function fixture(t) {
  const temporary = mkdtempSync(path.join(tmpdir(), 'vector-install-renderer-'));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
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
  assert.deepEqual(output.configuration.uci_options, { Hash: 64 });
  assert.equal(output.configuration.expected_runtime, null);
  assert.deepEqual(readFileSync(path.join(f.root, 'contracts/uci-engine-launch-profile.json')), before);
});

test('component identity mismatch fails before publishing a configuration', t => {
  const f = fixture(t);
  assert.equal(f.run().status, 0);
  f.context.component.version = '0.2.0';
  const result = f.run();
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, '');
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
