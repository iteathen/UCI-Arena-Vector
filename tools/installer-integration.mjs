import { createHash } from 'node:crypto';
import { lstatSync, readFileSync,openSync,closeSync,fstatSync,readSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {canonicalJson} from '../components/root-knowledge/tablebase.mjs';

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

function documentBytes(filename) {
  const info=noLinks(filename),same=(a,b)=>a.dev===b.dev&&a.ino===b.ino&&a.size===b.size&&a.mtimeMs===b.mtimeMs&&a.ctimeMs===b.ctimeMs;
  if(info.size<2||info.size>1024*1024)fail('document-too-large');
  const fd=openSync(filename,'r');
  try{const opened=fstatSync(fd);if(!same(info,opened))fail('document-changed');const bytes=Buffer.alloc(opened.size);let offset=0;while(offset<bytes.length){const n=readSync(fd,bytes,offset,bytes.length-offset,offset);if(!n)fail('document-ended-early');offset+=n;}if(!same(opened,fstatSync(fd))||!same(opened,noLinks(filename)))fail('document-changed');return bytes;}finally{closeSync(fd);}
}
function jsonBytes(bytes){
  const result = JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  if (!object(result)) fail('invalid-document');
  return result;
}
const jsonFile=filename=>jsonBytes(documentBytes(filename));

export function renderInstalledLaunchProfile(context) {
  if (!object(context) || context.schema !== 'arena_provider_install_context_v1' || context.schema_version !== 1
      || !object(context.component) || context.component.id !== 'uci_arena.vector'
      || typeof context.component.version !== 'string' || typeof context.enabled !== 'boolean'
      || !object(context.bindings) || Object.keys(context.bindings).some(name=>name!=='root_tablebase_provider')
      || !object(context.locators) || Object.keys(context.locators).some(name=>name!=='syzygy')
      || !object(context.locator_details) || Object.keys(context.locator_details).some(name=>name!=='syzygy')) fail('invalid-install-context');
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
  function verifiedDocument(name){
    const filename=path.join(root,relative(name)),bytes=documentBytes(filename),row=files.get(name);
    if(!row||bytes.length!==row.size_bytes||hash(bytes)!==row.sha256)fail('payload-identity-mismatch');
    return {filename,bytes,value:jsonBytes(bytes)};
  }
  const profile = verifiedDocument(manifest.entrypoints.uci_launch_profile).value;
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
  if(Object.hasOwn(options,'TimingPolicyFile')||Object.hasOwn(options,'TimingPolicySha256')){
    if(typeof options.TimingPolicyFile!=='string'||!SHA.test(options.TimingPolicySha256??''))fail('invalid-timing-binding');
    const policy=verifiedDocument(options.TimingPolicyFile);
    if(hash(policy.bytes)!==options.TimingPolicySha256)fail('timing-policy-identity-mismatch');
    options.TimingPolicyFile=policy.filename;
  }
  const generated_documents=[],knowledge={...profile.knowledge};
  if(context.bindings.root_tablebase_provider&&context.locators.syzygy){
    const providerRoot=absolute(context.bindings.root_tablebase_provider),datasetRoot=absolute(context.locators.syzygy),detail=context.locator_details.syzygy;
    noLinks(providerRoot,true);noLinks(datasetRoot,true);
    if(!object(detail)||detail.kind!=='syzygy'||absolute(detail.path)!==datasetRoot||!['saved_locator','install_receipt'].includes(detail.source)||typeof detail.storage_mode!=='string')fail('invalid-dataset-locator-authority');
    const selection=verifiedDocument('contracts/root-tablebase-selection.json').value;
    if(selection.schema!=='vector_root_tablebase_selection_v1'||selection.componentId!=='syzygy.root-provider'||selection.version!=='2.1.0'||!SHA.test(selection.manifestSha256??'')||!SHA.test(selection.contractSha256??''))fail('invalid-root-provider-selection');
    const providerManifest=path.join(providerRoot,'package-manifest.json'),contractPath=path.join(providerRoot,'contracts/offline-root-knowledge-v2.json');
    const manifestBytes=documentBytes(providerManifest),contractBytes=documentBytes(contractPath);
    if(hash(manifestBytes)!==selection.manifestSha256||hash(contractBytes)!==selection.contractSha256)fail('root-provider-identity-mismatch');
    const manifest=jsonBytes(manifestBytes),contract=jsonBytes(contractBytes);
    if(manifest.schema!=='uci_arena_root_provider_package_v1'||!Array.isArray(manifest.files)||!manifest.files.some(row=>row.path==='contracts/offline-root-knowledge-v2.json'&&row.sha256===selection.contractSha256)||contract.schema!=='uci_arena_root_knowledge_contract_v2'||contract.version!==selection.version)fail('root-provider-contract-mismatch');
    const datasetManifest=path.join(datasetRoot,'syzygy_manifest_v1.json'),datasetBytes=documentBytes(datasetManifest),dataset=jsonBytes(datasetBytes);
    if(dataset.schema!=='uci_arena_syzygy_manifest_v1'||!Array.isArray(dataset.files)||!dataset.files.length||dataset.files.length>2048)fail('invalid-dataset-selection');
    const names=dataset.files.map(row=>row.name),folded=new Set();
    for(const name of names){if(typeof name!=='string'||!/^K[QRBNP]*vK[QRBNP]*\.(rtbw|rtbz)$/.test(name)||name.split('.')[0].length-1<3||name.split('.')[0].length-1>6||folded.has(name.toLowerCase()))fail('invalid-dataset-member');folded.add(name.toLowerCase());}
    const configuration={schema:'uci_arena_syzygy_root_configuration_v1',dataset_root:datasetRoot,manifest_sha256:hash(datasetBytes),selected_files:names.sort()};
    if(Buffer.byteLength(JSON.stringify(configuration))>65536)fail('dataset-configuration-capacity');
    const binding={schema:'vector_root_tablebase_binding_v2',selectionSha256:hash(canonicalJson(selection)),componentRoot:providerRoot,configuration:{path:path.join(workspace,'root-provider-config.json'),canonicalSha256:hash(canonicalJson(configuration))}};
    generated_documents.push({path:'root-provider-config.json',document:configuration},{path:'root-provider-binding.json',document:binding});
    options.RootTablebaseBinding=path.join(workspace,'root-provider-binding.json');
    knowledge.syzygy={status:'configured-pending-provider-admission',source:detail.source,path:datasetRoot,component:selection.componentId,version:selection.version};
  }
  const executable = verifiedFile(profile.engine.executable);
  const program = verifiedFile(args.at(-1));
  return { schema: 'arena_provider_install_result_v1', schema_version: 1,
    configuration: { ...profile, component: { ...profile.component, root }, enabled: context.enabled, uci_options: options,knowledge,
      engine: { ...profile.engine, executable, arguments: [...args.slice(0, -1), program], working_directory: root } },
    generated_documents };
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
