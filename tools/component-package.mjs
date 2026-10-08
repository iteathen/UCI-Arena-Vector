import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const GENERATED = new Set(['arena-component.json', 'contracts/uci-engine-launch-profile.json', 'contracts/runtime-closure.json']);
const SHA = /^[0-9a-f]{64}$/u;
const COMMIT = /^[0-9a-f]{40}$/u;
const VERSION = /^\d+\.\d+\.\d+$/u;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);

function relativePath(value) {
  if (typeof value !== 'string' || !value || value.includes('\\') || value.includes(':')
      || /[\u0000-\u001f]/u.test(value) || path.posix.normalize(value) !== value
      || value === '.' || value.startsWith('../') || path.posix.isAbsolute(value)
      || value.split('/').some(part => /^(?:secrets|\.git|\.env(?:\..*)?)$/iu.test(part))) {
    throw new Error('unsafe component closure path');
  }
  return value;
}

function regularRoot(root) {
  const resolved = path.resolve(root);
  const info = lstatSync(resolved);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('component root must be a regular directory');
  return resolved;
}

function inventory(root, relative = '', seen = new Set()) {
  const files = [];
  for (const name of readdirSync(path.join(root, relative)).sort()) {
    const child = relativePath(relative ? `${relative}/${name}` : name);
    const folded = child.toLowerCase();
    if (seen.has(folded)) throw new Error('case-colliding component path');
    seen.add(folded);
    const status = lstatSync(path.join(root, child));
    if (status.isSymbolicLink()) throw new Error('component symlink/reparse entry is forbidden');
    if (status.isDirectory()) files.push(...inventory(root, child, seen));
    else if (status.isFile()) files.push({ path: child, sha256: hash(readFileSync(path.join(root, child))), size_bytes: status.size });
    else throw new Error('unsupported component filesystem entry');
  }
  return files;
}

function validateClosure(root, closure, version) {
  if (!VERSION.test(version) || closure?.schema !== 'vector_runtime_closure_v1'
      || closure.component_version !== version || !COMMIT.test(closure.vector_commit ?? '')
      || closure.node_version !== '26.11.1' || closure.qualification?.status !== 'pass'
      || !SHA.test(closure.qualification?.receipt_sha256 ?? '') || !Array.isArray(closure.files)
      || !Array.isArray(closure.libraries) || closure.libraries.length !== 3) {
    throw new Error('runtime closure identity or qualification is invalid');
  }
  const expected = new Map();
  const folded = new Set();
  for (const row of closure.files) {
    const relative = relativePath(row.path);
    if (GENERATED.has(relative) || folded.has(relative.toLowerCase()) || !SHA.test(row.sha256 ?? '')) {
      throw new Error('runtime closure file identity is invalid or duplicated');
    }
    folded.add(relative.toLowerCase());
    expected.set(relative, row.sha256);
  }
  const actual = inventory(root).filter(row => !GENERATED.has(row.path));
  if (actual.length !== expected.size || actual.some(row => expected.get(row.path) !== row.sha256)) {
    throw new Error('runtime closure inventory or file identity differs');
  }
  for (const required of ['bin/node.exe', 'dist/uci.mjs', 'dist/installer-integration.mjs']) {
    if (!expected.has(required)) throw new Error(`runtime closure omits ${required}`);
  }
  const names = new Set();
  for (const library of closure.libraries) {
    if (!['cuda-js', 'cuda-mcgs', 'cuda-js-tensor'].includes(library.name) || names.has(library.name)
        || !COMMIT.test(library.commit ?? '') || typeof library.version !== 'string'
        || !expected.has(relativePath(library.package_json))) throw new Error('library closure identity is invalid');
    names.add(library.name);
    const pkg = JSON.parse(readFileSync(path.join(root, library.package_json), 'utf8'));
    if (pkg.version !== library.version) throw new Error('library version differs from runtime closure');
  }
  if (!SHA.test(closure.model?.checkpoint_sha256 ?? '') || !SHA.test(closure.model?.parameters_sha256 ?? '')
      || expected.get(relativePath(closure.model?.parameters)) !== closure.model.parameters_sha256) {
    throw new Error('model identity differs from runtime closure');
  }
  const receiptPath = relativePath(closure.qualification.receipt);
  if (expected.get(receiptPath) !== closure.qualification.receipt_sha256) throw new Error('qualification receipt identity differs');
  const receipt = JSON.parse(readFileSync(path.join(root, receiptPath), 'utf8'));
  if (receipt.schema !== 'vector_runtime_qualification_v1' || receipt.status !== 'pass'
      || receipt.vector_commit !== closure.vector_commit || !Array.isArray(receipt.tests)
      || receipt.tests.some(test => test.status !== 'pass')
      || ['gpu-search', 'legal-game', 'clock-safety', 'lifecycle'].some(name => !receipt.tests.some(test => test.name === name))
      || !Array.isArray(receipt.files) || receipt.files.length !== expected.size - 1) {
    throw new Error('qualification does not pass the required exact-runtime gates');
  }
  const receiptNames = new Set();
  for (const row of receipt.files) {
    if (row.path === receiptPath || receiptNames.has(row.path) || expected.get(row.path) !== row.sha256) {
      throw new Error('qualification runtime file identity differs');
    }
    receiptNames.add(row.path);
  }
  return actual;
}

function tarHeader(relative, size, epoch) {
  const bytes = Buffer.alloc(512);
  let name = relative;
  let prefix = '';
  if (Buffer.byteLength(name) > 100) {
    for (let i = relative.lastIndexOf('/'); i > 0; i = relative.lastIndexOf('/', i - 1)) {
      if (Buffer.byteLength(relative.slice(0, i)) <= 155 && Buffer.byteLength(relative.slice(i + 1)) <= 100) {
        prefix = relative.slice(0, i); name = relative.slice(i + 1); break;
      }
    }
  }
  if (Buffer.byteLength(name) > 100) throw new Error('component path exceeds ustar limits');
  const octal = (offset, length, value) => {
    const encoded = value.toString(8).padStart(length - 1, '0');
    if (encoded.length >= length) throw new Error('component ustar numeric overflow');
    bytes.write(encoded, offset, length - 1, 'ascii');
  };
  bytes.write(name, 0, 100); octal(100, 8, relative.endsWith('.exe') || relative.endsWith('.mjs') ? 0o755 : 0o644);
  octal(108, 8, 0); octal(116, 8, 0); octal(124, 12, size); octal(136, 12, epoch);
  bytes.fill(32, 148, 156); bytes[156] = 48; bytes.write('ustar\0', 257, 6, 'ascii');
  bytes.write('00', 263, 2, 'ascii'); bytes.write('root', 265, 32); bytes.write('root', 297, 32);
  bytes.write(prefix, 345, 155);
  bytes.write(bytes.reduce((a, b) => a + b, 0).toString(8).padStart(6, '0'), 148, 6, 'ascii');
  bytes[155] = 32;
  return bytes;
}

export function buildAtomicComponent({ root, closure, version, sourceDateEpoch }) {
  root = regularRoot(root);
  if (!Number.isSafeInteger(sourceDateEpoch) || sourceDateEpoch < 0) throw new Error('invalid source date epoch');
  validateClosure(root, closure, version);
  const profile = { schema: 'arena_uci_engine_launch_profile_v1', schema_version: 1,
    component: { id: 'uci_arena.vector', version, root: '.' },
    engine: { adapter: 'standard_uci_v1', executable: 'bin/node.exe',
      arguments: ['--experimental-ffi', 'dist/uci.mjs'], working_directory: '.' },
    state: 'conservative', enabled: true, uci_options: {}, expected_runtime: null,
    evidence: {}, knowledge: {}, diagnostics: [] };
  mkdirSync(path.join(root, 'contracts'), { recursive: true });
  writeFileSync(path.join(root, 'contracts/uci-engine-launch-profile.json'), json(profile));
  writeFileSync(path.join(root, 'contracts/runtime-closure.json'), json(closure));
  const manifest = { schema: 'arena_install_component_v1', schema_version: 1,
    component_id: 'uci_arena.vector', component_version: version, target_triple: 'windows-x86_64',
    entrypoints: { uci_engine: 'bin/node.exe', uci_launch_profile: 'contracts/uci-engine-launch-profile.json',
      installer_integration: 'dist/installer-integration.mjs' },
    discovery: [{ kind: 'uci_engine', locator: { source: 'entrypoint', entrypoint: 'uci_engine' } }],
    capabilities: ['uci_engine', 'uci_engine_launch_profile_v1'], dependencies: ['node_runtime.private'],
    workspace_name: 'uci-arena-vector',
    installer_integration: { schema: 'arena_provider_installer_integration_v1', schema_version: 1,
      entrypoint: 'installer_integration', invocation: { kind: 'dependency_runtime',
        runtime_component_id: 'node_runtime.private', runtime_entrypoint: 'node' },
      arguments: ['--context'], workspace_name: 'uci-arena-vector', workspace_placement: 'product_data',
      configure_when_disabled: true, dependency_bindings: [], locator_bindings: [] },
    startup: {}, data_paths: [],
    files: inventory(root).filter(row => row.path !== 'arena-component.json') };
  writeFileSync(path.join(root, 'arena-component.json'), json(manifest));
  verifyAtomicComponent(root);
  const chunks = [];
  for (const row of inventory(root)) {
    const bytes = readFileSync(path.join(root, row.path));
    chunks.push(tarHeader(row.path, bytes.length, sourceDateEpoch), bytes);
    const padding = (512 - bytes.length % 512) % 512;
    if (padding) chunks.push(Buffer.alloc(padding));
  }
  chunks.push(Buffer.alloc(1024));
  const archive = gzipSync(Buffer.concat(chunks), { level: 9, mtime: 0 });
  return { manifest, profile, archive, artifact_sha256: hash(archive), component_manifest_sha256: hash(json(manifest)) };
}

export function verifyAtomicComponent(root) {
  root = regularRoot(root);
  const actual = inventory(root);
  const manifest = JSON.parse(readFileSync(path.join(root, 'arena-component.json'), 'utf8'));
  if (manifest?.schema !== 'arena_install_component_v1' || manifest.schema_version !== 1
      || manifest.component_id !== 'uci_arena.vector' || !VERSION.test(manifest.component_version ?? '')
      || manifest.target_triple !== 'windows-x86_64' || !Array.isArray(manifest.files)) throw new Error('component identity is invalid');
  const rows = new Map();
  for (const row of manifest.files) {
    const relative = relativePath(row.path);
    if (rows.has(relative) || relative === 'arena-component.json' || !SHA.test(row.sha256 ?? '')
        || !Number.isSafeInteger(row.size_bytes) || row.size_bytes < 0) throw new Error('invalid component file identity');
    rows.set(relative, row);
  }
  if (actual.length !== rows.size + 1 || actual.some(row => row.path !== 'arena-component.json'
      && (rows.get(row.path)?.sha256 !== row.sha256 || rows.get(row.path)?.size_bytes !== row.size_bytes))) {
    throw new Error('component inventory or file identity differs');
  }
  if (manifest.entrypoints?.uci_engine !== 'bin/node.exe'
      || manifest.entrypoints?.uci_launch_profile !== 'contracts/uci-engine-launch-profile.json'
      || manifest.entrypoints?.installer_integration !== 'dist/installer-integration.mjs'
      || !manifest.capabilities?.includes('uci_engine_launch_profile_v1')) throw new Error('component launch identity differs');
  const integration = manifest.installer_integration;
  if (integration?.schema !== 'arena_provider_installer_integration_v1' || integration.schema_version !== 1
      || integration.entrypoint !== 'installer_integration' || integration.invocation?.kind !== 'dependency_runtime'
      || integration.invocation.runtime_component_id !== 'node_runtime.private'
      || integration.invocation.runtime_entrypoint !== 'node' || !manifest.dependencies?.includes('node_runtime.private')
      || integration.workspace_placement !== 'product_data' || integration.workspace_name !== 'uci-arena-vector'
      || manifest.workspace_name !== integration.workspace_name || integration.configure_when_disabled !== true
      || JSON.stringify(integration.arguments) !== JSON.stringify(['--context'])
      || JSON.stringify(integration.dependency_bindings) !== '[]' || JSON.stringify(integration.locator_bindings) !== '[]') {
    throw new Error('component installer integration differs');
  }
  const closure = JSON.parse(readFileSync(path.join(root, 'contracts/runtime-closure.json'), 'utf8'));
  validateClosure(root, closure, manifest.component_version);
  const profile = JSON.parse(readFileSync(path.join(root, manifest.entrypoints.uci_launch_profile), 'utf8'));
  if (profile.component?.id !== manifest.component_id || profile.component?.version !== manifest.component_version
      || profile.component.root !== '.' || profile.engine?.executable !== 'bin/node.exe'
      || JSON.stringify(profile.engine.arguments) !== JSON.stringify(['--experimental-ffi', 'dist/uci.mjs'])
      || profile.engine.working_directory !== '.' || profile.engine.adapter !== 'standard_uci_v1') throw new Error('component launch profile identity differs');
  return manifest;
}
