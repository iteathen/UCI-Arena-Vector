import { createHash } from 'node:crypto';
import { readFileSync, lstatSync, openSync, readSync, closeSync, realpathSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import path from 'node:path';

export const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export function fileDigest(filename) {
  const fd=openSync(filename,'r');const buffer=Buffer.allocUnsafe(65536);const hash=createHash('sha256');
  try{let n;while((n=readSync(fd,buffer,0,buffer.length,null))>0)hash.update(buffer.subarray(0,n));return hash.digest('hex');}
  finally{closeSync(fd);}
}
function regular(root,relative) {
  if(typeof relative!=='string'||relative.includes('\\')||/[:\u0000-\u001f]/u.test(relative)||path.isAbsolute(relative)||path.posix.normalize(relative)!==relative||relative==='.'||relative.startsWith('../'))throw new Error('unsafe artifact inventory path');
  const filename=path.resolve(root,...relative.split('/'));
  if(!filename.startsWith(`${root}${path.sep}`))throw new Error('escaping artifact inventory path');
  let cursor=path.parse(filename).root;
  for(const part of path.relative(cursor,filename).split(path.sep)) {
    cursor=path.join(cursor,part);if(lstatSync(cursor).isSymbolicLink())throw new Error('artifact inventory reparse point is forbidden');
  }
  if(!lstatSync(filename).isFile())throw new Error('artifact inventory requires regular file');return filename;
}
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
function physicalIdentity(filename,directory=false) {
  const absolute=path.resolve(filename);
  let cursor=path.parse(absolute).root;
  for(const part of path.relative(cursor,absolute).split(path.sep).filter(Boolean)) {
    cursor=path.join(cursor,part);
    if(lstatSync(cursor).isSymbolicLink())throw new Error('registered launch reparse point is forbidden');
  }
  const status=lstatSync(absolute);
  if(directory?!status.isDirectory():!status.isFile())throw new Error('registered launch has wrong path kind');
  const physical=realpathSync.native(absolute);
  return process.platform==='win32'?physical.toLowerCase():physical;
}
function samePhysicalPath(actual,expected,directory=false) {
  if(typeof actual!=='string'||!path.isAbsolute(actual))return false;
  try{return physicalIdentity(actual,directory)===physicalIdentity(expected,directory);}catch{return false;}
}
export function validateLaunchArtifact(request) {
  const binding=request.runtime_binding;const component=binding?.component;
  if(binding?.schema!=='uci_arena_evidence_runtime_binding_v2'||binding.entrypoint!=='evidence_runtime_contract'
    ||component?.id!=='uci_arena.vector'||typeof component.root!=='string'||!path.isAbsolute(component.root))throw new Error('Vector runtime binding is incompatible');
  const root=path.resolve(component.root);const manifestPath=regular(root,component.manifest);
  if(lstatSync(manifestPath).size>33554432||fileDigest(manifestPath)!==component.manifest_sha256)throw new Error('component manifest identity mismatch');
  const manifest=JSON.parse(readFileSync(manifestPath,'utf8'));
  if(manifest.schema!=='arena_install_component_v1'||manifest.schema_version!==1||manifest.component_id!==component.id
    ||manifest.component_version!==component.version||!manifest.capabilities?.includes('evidence_runtime_contract_v2')
    ||typeof manifest.entrypoints?.evidence_runtime_contract!=='string'||!Array.isArray(manifest.files)||manifest.files.length>100000)throw new Error('Vector component capability is incompatible');
  const files=new Map();const aliases=new Set();
  for(const row of manifest.files) {
    if(!plain(row)||!Number.isSafeInteger(row.size_bytes)||row.size_bytes<0||!/^[a-f0-9]{64}$/u.test(row.sha256??'')||typeof row.path!=='string'||aliases.has(row.path.toLowerCase()))throw new Error('artifact inventory identity is invalid');
    const file=regular(root,row.path);if(lstatSync(file).size!==row.size_bytes||fileDigest(file)!==row.sha256)throw new Error('artifact inventory bytes drifted');
    files.set(row.path,file);aliases.add(row.path.toLowerCase());
  }
  const contractPath=files.get(manifest.entrypoints.evidence_runtime_contract);if(!contractPath)throw new Error('runtime contract is absent from inventory');
  const contract=JSON.parse(readFileSync(contractPath,'utf8'));const expected=request.runtime_identity;
  if(contract.schema!=='uci_arena_evidence_runtime_v2'||contract.component_id!==component.id||contract.component_version!==component.version
    ||manifest.target_triple!==contract.target_triple||expected?.component_id!==component.id||expected.component_version!==component.version
    ||expected.manifest_sha256!==component.manifest_sha256||expected.contract_sha256!==fileDigest(contractPath))throw new Error('artifact runtime identity mismatch');
  const identityPath=files.get(contract.runtime_identity?.path);
  if(!identityPath||lstatSync(identityPath).size>1048576||fileDigest(identityPath)!==expected.runtime_identity_sha256
    ||contract.runtime_identity.schema!=='vector_engine_runtime_identity_v1')throw new Error('engine runtime identity inventory mismatch');
  const expectedIdentity=JSON.parse(readFileSync(identityPath,'utf8'));
  const profilePath=files.get('contracts/uci-engine-launch-profile.json');if(!profilePath)throw new Error('managed UCI profile is absent from inventory');
  const profile=JSON.parse(readFileSync(profilePath,'utf8'));
  if(profile.schema!=='arena_uci_engine_launch_profile_v1'||profile.schema_version!==1||profile.component?.id!==component.id
    ||profile.component.version!==component.version||profile.component.root!=='.'||profile.enabled!==true
    ||profile.engine?.adapter!=='standard_uci_v1'||profile.engine.working_directory!=='.'
    ||!Array.isArray(profile.engine.arguments)||profile.engine.arguments.length!==2||profile.engine.arguments[0]!=='--experimental-ffi'
    ||typeof profile.engine.arguments[1]!=='string'||!profile.engine.arguments[1].endsWith('.mjs')
    ||profile.state!=='conservative'||profile.expected_runtime!==null)throw new Error('managed UCI launch profile is incompatible');
  const executable=files.get(profile.engine.executable);const entrypoint=files.get(profile.engine.arguments[1]);
  const launch=request.launch;
  if(!executable||!entrypoint||!samePhysicalPath(launch?.executable,executable)||!samePhysicalPath(launch?.working_directory,root,true)
    ||!Array.isArray(launch.arguments)||launch.arguments.length!==2||launch.arguments[0]!==profile.engine.arguments[0]
    ||typeof launch.arguments[1]!=='string'||!samePhysicalPath(path.resolve(launch.working_directory,launch.arguments[1]),entrypoint)||!plain(launch.uci_options)
    ||!isDeepStrictEqual(request.target_identity?.launch,launch)
    ||request.target_identity.engine_sha256!==fileDigest(executable))throw new Error('registered UCI launch differs from admitted artifact');
  return {root,profile,expectedIdentity,launch:{executable:launch.executable,args:[...launch.arguments],cwd:launch.working_directory}};
}
export function validateEngineIdentity(actual,expected) {
  if(!plain(expected)||expected.schema!=='vector_engine_runtime_identity_v1')throw new Error('expected runtime identity is unavailable');
  if(!plain(actual)||actual.schema!==expected.schema||actual.fixture===true)throw new Error('fixture or missing engine runtime identity');
  function subset(value,wanted) {
    if(plain(wanted))return plain(value)&&Object.entries(wanted).every(([key,item])=>subset(value[key],item));
    if(Array.isArray(wanted))return Array.isArray(value)&&wanted.length===value.length&&wanted.every((item,i)=>subset(value[i],item));
    return value===wanted;
  }
  if(!subset(actual,expected))throw new Error('actual engine runtime identity differs from declared artifact');
}
