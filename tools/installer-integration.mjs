import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SHA = /^[0-9a-f]{64}$/u;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const scalar = value => typeof value === 'boolean' || Number.isSafeInteger(value)
  || (typeof value === 'string' && value.length <= 4096 && !/[\u0000-\u001f\u007f]/u.test(value));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

function fail(code) { throw new Error(code); }

function absolute(value) {
  if (typeof value !== 'string' || !path.isAbsolute(value) || /[\u0000-\u001f]/u.test(value)) fail('invalid-path');
  return path.resolve(value);
}

function relative(value) {
  if (typeof value !== 'string' || !value || /[\\:\u0000-\u001f]/u.test(value)
      || path.posix.normalize(value) !== value || value === '.' || value.startsWith('../')
      || path.posix.isAbsolute(value)
      || value.split('/').some(part => /^(?:secrets|\.git|\.env(?:\..*)?)$/iu.test(part))) fail('invalid-payload-path');
  return value;
}

function noLinks(filename, directory = false) {
  const resolved = absolute(filename);
  let cursor = path.parse(resolved).root;
  for (const part of resolved.slice(cursor.length).split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, part);
    if (lstatSync(cursor).isSymbolicLink()) fail('linked-payload-path');
  }
  const info = lstatSync(resolved);
  if (directory ? !info.isDirectory() : !info.isFile()) fail('invalid-file-kind');
  return info;
}

function jsonFile(filename) {
  const info = noLinks(filename);
  if (info.size > 1024 * 1024) fail('document-too-large');
  const result = JSON.parse(readFileSync(filename, 'utf8'));
  if (!object(result)) fail('invalid-document');
  return result;
}

export function renderInstalledLaunchProfile(context) {
  if (!object(context) || context.schema !== 'arena_provider_install_context_v1' || context.schema_version !== 1
      || !object(context.component) || context.component.id !== 'uci_arena.vector'
      || typeof context.component.version !== 'string' || typeof context.enabled !== 'boolean'
      || !object(context.bindings) || Object.keys(context.bindings).length
      || !object(context.locators) || Object.keys(context.locators).length
      || !object(context.locator_details) || Object.keys(context.locator_details).length) fail('invalid-install-context');
  const root = absolute(context.component.root);
  const workspace = absolute(context.workspace);
  noLinks(root, true);
  noLinks(workspace, true);
  const workspaceRelative = path.relative(root, workspace);
  if (!workspaceRelative || (!workspaceRelative.startsWith(`..${path.sep}`)
      && workspaceRelative !== '..' && !path.isAbsolute(workspaceRelative))) fail('immutable-workspace');
  const manifest = jsonFile(path.join(root, 'arena-component.json'));
  if (manifest.schema !== 'arena_install_component_v1' || manifest.schema_version !== 1
      || manifest.component_id !== context.component.id || manifest.component_version !== context.component.version
      || !object(manifest.entrypoints) || !Array.isArray(manifest.files)
      || !Array.isArray(manifest.capabilities) || !manifest.capabilities.includes('uci_engine_launch_profile_v1')) fail('component-identity-mismatch');
  const files = new Map();
  const folded = new Set();
  for (const row of manifest.files) {
    const name = relative(row.path);
    if (folded.has(name.toLowerCase()) || !SHA.test(row.sha256 ?? '')
        || !Number.isSafeInteger(row.size_bytes) || row.size_bytes < 0) fail('invalid-inventory');
    folded.add(name.toLowerCase());
    files.set(name, row);
  }
  function verifiedFile(name) {
    const filename = path.join(root, relative(name));
    const row = files.get(name);
    if (!row || noLinks(filename).size !== row.size_bytes
        || hash(readFileSync(filename)) !== row.sha256) fail('payload-identity-mismatch');
    return filename;
  }
  const profile = jsonFile(verifiedFile(manifest.entrypoints.uci_launch_profile));
  if (profile.schema !== 'arena_uci_engine_launch_profile_v1' || profile.schema_version !== 1
      || !object(profile.component) || profile.component.id !== context.component.id
      || profile.component.version !== context.component.version || profile.component.root !== '.'
      || !object(profile.engine) || profile.engine.adapter !== 'standard_uci_v1'
      || profile.engine.working_directory !== '.' || profile.engine.executable !== manifest.entrypoints.uci_engine
      || profile.state !== 'conservative' || profile.enabled !== true || profile.expected_runtime !== null
      || !object(profile.uci_options) || Object.keys(profile.uci_options).length > 128
      || !object(profile.evidence) || !object(profile.knowledge)
      || !Array.isArray(profile.diagnostics) || profile.diagnostics.length > 32) fail('invalid-launch-profile');
  const args = profile.engine.arguments;
  if (!Array.isArray(args) || !(args.length === 1
      || (args.length === 2 && args[0] === '--experimental-ffi'))
      || typeof args.at(-1) !== 'string' || !args.at(-1).endsWith('.mjs')) fail('invalid-launch-arguments');
  for (const [name, value] of Object.entries(profile.uci_options)) {
    if (!/^[A-Za-z0-9 _-]{1,128}$/u.test(name) || !scalar(value)) fail('invalid-uci-option');
  }
  const options = { ...profile.uci_options };
  if (Object.hasOwn(options, 'ModelRoot')) {
    if (!object(manifest.default_model) || options.ModelRoot !== manifest.default_model.root) fail('model-root-mismatch');
    options.ModelRoot = path.join(root, relative(manifest.default_model.root));
    noLinks(options.ModelRoot, true);
  }
  const executable = verifiedFile(profile.engine.executable);
  const program = verifiedFile(args.at(-1));
  return { schema: 'arena_provider_install_result_v1', schema_version: 1,
    configuration: { ...profile, component: { ...profile.component, root }, enabled: context.enabled, uci_options: options,
      engine: { ...profile.engine, executable, arguments: [...args.slice(0, -1), program], working_directory: root } },
    generated_documents: [] };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 4 || process.argv[2] !== '--context') fail('invalid-invocation');
    const result = renderInstalledLaunchProfile(jsonFile(absolute(process.argv[3])));
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch {
    process.stderr.write('vector-install-configuration-rejected\n');
    process.exitCode = 1;
  }
}
