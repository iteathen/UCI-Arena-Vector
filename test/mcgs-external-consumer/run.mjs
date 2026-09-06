import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile as execFileCallback } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { buildExternalConsumerComposition } from './profile.mjs';

const execFile = promisify(execFileCallback);
const MCGS_REVISION = 'e4ff2614006dea054359560827dda9b93d9fe6cd';
const MCGS_SPEC = `github:iteathen/CUDA-MCGS#${MCGS_REVISION}`;
const SCHEMAS = ['domain', 'graph', 'policy', 'resource', 'progress', 'output'];
const here = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(here, '..', '..');
const gitCommand = process.platform === 'win32' ? 'git.exe' : 'git';
const cases = [];

async function runCase(id, body) {
  try {
    await body();
    cases.push({ id, status: 'pass' });
    console.log(`case=${id} result=pass`);
  } catch (error) {
    cases.push({ id, status: 'fail', error: { name: error?.name ?? null, code: error?.code ?? null, message: error?.message ?? String(error) } });
    console.error(`case=${id} result=fail error=${JSON.stringify(error?.message ?? String(error))}`);
  }
}
async function execNpm(args, options) {
  if (process.platform !== 'win32') return execFile('npm', args, options);
  const npmCli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
  await access(npmCli);
  return execFile(process.execPath, [npmCli, ...args], options);
}
async function gitObject(...args) {
  const { stdout } = await execFile(gitCommand, ['-C', repositoryRoot, 'rev-parse', ...args], { maxBuffer: 1024 * 1024 });
  return stdout.trim();
}
function sourceTextSha256(bytes) {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  return createHash('sha256').update(Buffer.from(text.replace(/\r\n?/g, '\n'), 'utf8')).digest('hex');
}

async function installExactMcgs(tempRoot) {
  const packRoot = path.join(tempRoot, 'pack');
  const consumerRoot = path.join(tempRoot, 'consumer');
  await mkdir(packRoot, { recursive: true });
  await mkdir(consumerRoot, { recursive: true });
  const { stdout } = await execNpm(['pack', MCGS_SPEC, '--json', '--pack-destination', packRoot], {
    cwd: tempRoot,
    maxBuffer: 32 * 1024 * 1024,
  });
  const packed = JSON.parse(stdout);
  assert.equal(packed.length, 1, 'exact MCGS archive must pack to one npm artifact');
  const tarball = path.join(packRoot, packed[0].filename);
  await writeFile(path.join(consumerRoot, 'package.json'), `${JSON.stringify({ private: true, type: 'module' }, null, 2)}\n`, 'utf8');
  await execNpm(['install', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false', tarball], {
    cwd: consumerRoot,
    maxBuffer: 32 * 1024 * 1024,
  });
  const shimPath = path.join(consumerRoot, 'consumer.mjs');
  await writeFile(shimPath, `
export * as library from 'cuda-mcgs';
export * as compiler from 'cuda-mcgs/search-compiler';
export const packageJsonUrl = import.meta.resolve('cuda-mcgs/package.json');
export function schemaUrl(name) { return import.meta.resolve('cuda-mcgs/schemas/search-ir/0.2.0/' + name); }
export async function importPrivateValidation() { return import('cuda-mcgs/components/search-compiler/src/validation.mjs'); }
export async function importTestingPort() { return import('cuda-mcgs/search-compiler/testing'); }
`, 'utf8');
  const shim = await import(`${pathToFileURL(shimPath).href}?run=${Date.now()}`);
  return { packed: packed[0], consumerRoot, shim };
}
async function schemaShas(shim) {
  const result = {};
  for (const name of SCHEMAS) {
    const url = shim.schemaUrl(`${name}-profile.schema.json`);
    result[name] = sourceTextSha256(await readFile(new URL(url)));
  }
  return result;
}

const vectorRevision = await gitObject('HEAD');
const vectorTree = await gitObject('HEAD^{tree}');
assert.match(vectorRevision, /^[0-9a-f]{40}$/);
assert.match(vectorTree, /^[0-9a-f]{40}$/);

let tempRoot = await mkdtemp(path.join(os.tmpdir(), 'vector-mcgs-external-consumer-'));
let installed;
let composed;
try {
  installed = await installExactMcgs(tempRoot);
  const { library, compiler } = installed.shim;
  const packageJsonPath = fileURLToPath(installed.shim.packageJsonUrl);
  const installedPackageRoot = path.dirname(packageJsonPath);
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
  const shas = await schemaShas(installed.shim);

  await runCase('MCGS-EXT-C00-exact-installed-package-boundary', async () => {
    assert.equal(packageJson.name, 'cuda-mcgs');
    assert.equal(packageJson.version, '0.0.0-dev.0');
    assert.equal(packageJson.private, true);
    assert.equal(installed.packed.name, 'cuda-mcgs');
    assert.equal(installed.packed.version, '0.0.0-dev.0');
    assert.match(installed.packed.shasum, /^[0-9a-f]{40}$/);
    assert.match(installed.packed.integrity, /^sha512-/);
    assert.equal(MCGS_SPEC.endsWith(MCGS_REVISION), true);
    await assert.rejects(access(path.join(installedPackageRoot, 'conformance')), (error) => error?.code === 'ENOENT');
    await assert.rejects(access(path.join(installedPackageRoot, 'components', 'search-compiler', 'testing.mjs')), (error) => error?.code === 'ENOENT');
  });

  await runCase('MCGS-EXT-C01-public-evaluator-free-owner-normalization', () => {
    const authority = compiler.getAcceptedContractAuthority();
    composed = buildExternalConsumerComposition({ compiler, library, authority, schemaShas: shas, vectorRevision, mcgsRevision: MCGS_REVISION });
    assert.equal(Object.isFrozen(authority), true);
    assert.equal(composed.graph.normalized.mode, 'stateless');
    assert.equal(composed.policy.normalized.evaluatorMode, 'absent');
    assert.deepEqual(composed.policy.normalized.value, { kind: 'none' });
    assert.deepEqual(composed.policy.normalized.backup, { kind: 'none' });
    assert.equal(composed.ownerResults.some(({ normalized }) => normalized.schema === 'cuda-mcgs.evaluator-profile/0.2.0'), false);
    assert.equal(composed.graph.normalized.objectKinds.length, 0);
  });

  await runCase('MCGS-EXT-C02-root-resolve-compose-direct-equivalence', () => {
    const authority = compiler.getAcceptedContractAuthority();
    const directResolved = compiler.createResolvedComposerInput(structuredClone(composed.profileTemplate), structuredClone(composed.generator));
    assert.deepEqual(composed.resolved.identity, directResolved.identity);
    const facade = library.compose(composed.resolved.normalized, authority, composed.context);
    const direct = compiler.composeResolvedEngine(composed.resolved.normalized, authority, composed.context);
    assert.deepEqual(facade.publication.identity, direct.publication.identity);
    assert.deepEqual(facade.compositionProfile.identity, direct.compositionProfile.identity);
    assert.deepEqual(facade.searchProgram.identity, direct.searchProgram.identity);
    assert.deepEqual(facade.executionPackage.identity, direct.executionPackage.identity);
    assert.equal(facade.executionPackage.normalized.semantic.sessionProfile.kind, 'absent');
    assert.equal(facade.executionPackage.normalized.semantic.stageProfile.kind, 'absent');
    assert.equal(facade.executionPackage.normalized.semantic.channelProfile.kind, 'absent');
    assert.equal('runtime' in library, false);
    assert.equal('cudaJs' in library, false);
  });

  await runCase('MCGS-EXT-F01-stale-authority-fails-and-retry-succeeds', () => {
    const authority = compiler.getAcceptedContractAuthority();
    const stale = structuredClone(authority);
    stale.contractSet.contracts[0].sha256 = '0'.repeat(64);
    const failed = library.tryCompose(composed.resolved.normalized, stale, composed.context);
    assert.equal(failed.status, 'failure');
    assert.equal(failed.publication, null);
    assert.equal(failed.diagnostic.code, 'COMPOSER_AUTHORITY_DRIFT');
    const retried = library.compose(composed.resolved.normalized, authority, composed.context);
    assert.equal(retried.executionPackage.normalized.schema, 'cuda-mcgs.execution-package/0.2.0');
  });

  await runCase('MCGS-EXT-F02-wrong-owner-role-context-rejected', () => {
    assert.throws(() => compiler.createProgramPackageCompositionContext(composed.resolved.normalized, {
      profileResults: composed.ownerResults,
      resourceResult: composed.progress,
      progressResult: composed.progress,
      outputResult: composed.output,
      sessionResult: null,
      stageResult: null,
      channelResult: null,
      composerContributionIdentity: composed.context.composerContributionIdentity,
    }), (error) => error?.code === 'COMPOSER_CONTEXT_PROFILE');
  });

  await runCase('MCGS-EXT-F03-private-and-testing-imports-rejected', async () => {
    await assert.rejects(installed.shim.importPrivateValidation(), (error) => error?.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED');
    await assert.rejects(installed.shim.importTestingPort(), (error) => error?.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED');
  });
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

await runCase('MCGS-EXT-C03-temporary-package-state-cleaned', async () => {
  await assert.rejects(access(tempRoot), (error) => error?.code === 'ENOENT');
});

const failed = cases.filter(({ status }) => status !== 'pass');
const summary = {
  schema: 'vector.cuda-mcgs-external-consumer-evidence/0.1.0',
  status: failed.length === 0 ? 'pass' : 'failed',
  vector: { repository: 'iteathen/UCI-Arena-Vector', revision: vectorRevision, tree: vectorTree },
  cudaMcgs: { repository: 'iteathen/CUDA-MCGS', revision: MCGS_REVISION, sourceSpec: MCGS_SPEC, package: 'cuda-mcgs@0.0.0-dev.0' },
  artifact: installed ? { filename: installed.packed.filename, shasum: installed.packed.shasum, integrity: installed.packed.integrity, size: installed.packed.size, unpackedSize: installed.packed.unpackedSize, entryCount: installed.packed.entryCount } : null,
  surface: { evaluator: 'absent', graph: 'stateless', session: 'absent', stage: 'absent', channel: 'absent', ignition: 'not-performed' },
  identities: composed ? { resolvedInput: composed.resolved.identity, ownerProfiles: Object.fromEntries(composed.ownerResults.map(({ normalized, identity }) => [normalized.id, identity])) } : null,
  environment: { node: process.version, platform: process.platform, architecture: process.arch },
  cases,
  claimLimits: ['cuda-free', 'pre-ignition', 'synthetic-product-neutral-semantics', 'no-native-or-provider-qualification', 'no-chess-or-model-readiness'],
};
console.log(JSON.stringify(summary));
if (failed.length > 0) {
  const error = new Error(`CUDA-MCGS external-consumer conformance failed: ${failed.map(({ id }) => id).join(', ')}`);
  error.code = 'VECTOR_MCGS_EXTERNAL_CONSUMER';
  throw error;
}
