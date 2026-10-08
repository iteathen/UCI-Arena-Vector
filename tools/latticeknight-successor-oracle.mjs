import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sha256, parseArguments, assertNewEvidenceDirectory, canonicalJson } from './latticeknight-successor-candidate.mjs';

function fp32Bytes(values) {
  const bytes = Buffer.alloc(values.length * 4);
  for (let i = 0; i < values.length; i++) {
    if (!Number.isFinite(values[i])) throw new Error('Nonfinite numerical reference');
    bytes.writeFloatLE(values[i], i * 4);
  }
  return bytes;
}
const SCENARIOS = Object.freeze([
  { id: 'full', capacity: 2, fens: ['rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'r3k2r/p1ppqpb1/bn2pnp1/2pP4/1p2P3/2N2N2/PPQBBPPP/R3K2R b KQkq - 3 12'] },
  { id: 'partial', capacity: 2, fens: ['rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'] },
]);

export async function measureOracleBatches({ runtime, adapter, modelPath, scenarios = SCENARIOS }) {
  const cleanup = { sessionCreated: false, sessionReleased: false, releaseAttempts: 0, productNativeCodeUsed: false };
  let session, failure; const batches = [];
  try {
    session = await runtime.InferenceSession.create(modelPath, { executionProviders: ['cpu'], graphOptimizationLevel: 'disabled', intraOpNumThreads: 1, interOpNumThreads: 1 });
    cleanup.sessionCreated = true;
    if (canonicalJson(session.inputNames) !== canonicalJson(['features']) || canonicalJson([...session.outputNames].sort()) !== canonicalJson(['policy', 'value'])) throw new Error('ONNX input/output contract mismatch');
    for (const scenario of scenarios) {
      const n = scenario.fens.length;
      if (!Number.isSafeInteger(scenario.capacity) || n < 1 || n > scenario.capacity) throw new Error('Batch capacity invalid');
      const input = new Float32Array(n * 1088);
      const positions = scenario.fens.map((fen, index) => {
        const result = adapter.materializeFen(fen);
        if (!(Array.isArray(result.features) || result.features instanceof Float32Array) || result.features.length !== 1088) throw new Error('Producer feature dimensions invalid');
        const bytes = fp32Bytes(result.features); input.set(result.features, index * 1088);
        return { fen, canonicalFen: result.canonical_fen ?? null, originalSide: result.original_side ?? null, featureSha256: sha256(bytes) };
      });
      const result = await session.run({ features: new runtime.Tensor('float32', input, [n, 17, 8, 8]) });
      for (const [name, width] of [['policy', 4162], ['value', 1]]) {
        const tensor = result[name];
        if (tensor?.type !== 'float32' || canonicalJson(tensor.dims) !== canonicalJson([n, width]) || tensor.data.length !== n * width) throw new Error(`ONNX ${name} output shape/dtype mismatch`);
      }
      batches.push({ id: scenario.id, capacity: scenario.capacity, itemCount: n, positions, features: fp32Bytes(input), policy: fp32Bytes(result.policy.data), value: fp32Bytes(result.value.data) });
    }
  } catch (error) { failure = error; }
  finally {
    if (session) {
      cleanup.releaseAttempts++;
      try { await session.release(); cleanup.sessionReleased = true; }
      catch (error) { cleanup.releaseError = error.message; failure ??= error; }
    }
  }
  if (failure) { failure.cleanup = cleanup; throw failure; }
  return { batches, cleanup };
}

export function validateOracleInstall(pkg, lock, expected) {
  if (pkg.name !== expected.name || pkg.version !== expected.version) throw new Error('Official ONNX Runtime package version mismatch');
  const entry = lock?.packages?.['node_modules/onnxruntime-node'];
  if (entry?.version !== expected.version || entry.integrity !== expected.integrity || entry.resolved !== expected.tarball) throw new Error('Official ONNX Runtime registry integrity mismatch');
}

export async function runOracle({ candidateDirectory, outputDirectory, runtimeModule }) {
  const root = path.resolve(candidateDirectory), runtimeRoot = path.resolve(runtimeModule);
  const expected = JSON.parse(fs.readFileSync(new URL('../test/fixtures/model-successor/latticeknight-73091.json', import.meta.url)));
  const candidate = JSON.parse(fs.readFileSync(path.join(root, 'candidate.json')));
  for (const [key, value] of Object.entries(expected)) {
    if (key !== 'qualificationStatus' && canonicalJson(candidate[key]) !== canonicalJson(value)) throw new Error(`Candidate identity mismatch: ${key}`);
  }
  const artifacts = { parameter: 'parameters.f32.bin', descriptor: 'descriptor.json', adapter: 'feature-adapter.mjs', onnx: 'model.onnx' };
  for (const [key, name] of Object.entries(artifacts)) if (sha256(fs.readFileSync(path.join(root, name))) !== expected[`${key}Sha256`]) throw new Error(`Candidate ${key} artifact identity mismatch`);
  const packageFile = path.join(runtimeRoot, 'package.json'), pkg = JSON.parse(fs.readFileSync(packageFile));
  const lockFile = path.resolve(runtimeRoot, '..', '..', 'package-lock.json');
  validateOracleInstall(pkg, JSON.parse(fs.readFileSync(lockFile)), expected.oraclePackage);
  // Caller supplies an installed official package; no provider discovery, native binding, or build lives here.
  const runtime = createRequire(import.meta.url)(runtimeRoot);
  const adapter = await import(pathToFileURL(path.join(root, 'feature-adapter.mjs')).href);
  const directory = assertNewEvidenceDirectory(outputDirectory, [root, runtimeRoot]);
  fs.mkdirSync(path.dirname(directory), { recursive: true }); fs.mkdirSync(directory);
  const write = (name, bytes) => fs.writeFileSync(path.join(directory, name), bytes, { flag: 'wx' });
  let measured;
  try { measured = await measureOracleBatches({ runtime, adapter, modelPath: path.join(root, 'model.onnx') }); }
  catch (error) {
    write('cleanup.json', `${JSON.stringify({ schema: 'vector-independent-model-oracle-cleanup-v1', status: 'failed', ...error.cleanup, failure: error.message }, null, 2)}\n`);
    throw error;
  }
  const batches = measured.batches.map((batch) => {
    const files = {};
    for (const key of ['features', 'policy', 'value']) {
      const name = `${batch.id}.${key}.f32.bin`; write(name, batch[key]);
      files[key] = { file: name, byteLength: batch[key].length, sha256: sha256(batch[key]), shape: key === 'features' ? [batch.itemCount, 17, 8, 8] : [batch.itemCount, key === 'policy' ? 4162 : 1] };
    }
    return { id: batch.id, capacity: batch.capacity, itemCount: batch.itemCount, positions: batch.positions, files };
  });
  const reference = { schema: 'vector-independent-successor-onnx-reference-v1', candidateId: expected.candidateId, checkpointSha256: expected.checkpointSha256, parameterSha256: expected.parameterSha256, onnxSha256: expected.onnxSha256, featureAdapterSha256: expected.adapterSha256, oracle: { package: pkg.name, version: pkg.version, registryIntegrity: expected.oraclePackage.integrity, packageJsonSha256: sha256(fs.readFileSync(packageFile)), packageLockSha256: sha256(fs.readFileSync(lockFile)), provider: 'cpu', graphOptimizationLevel: 'disabled', nodeVersion: process.version, platform: process.platform, architecture: process.arch }, batches, qualificationStatus: 'independent_reference_measured_physical_tensor_comparison_pending', tensorParityClaimed: false };
  write('reference.json', `${JSON.stringify(reference, null, 2)}\n`);
  write('cleanup.json', `${JSON.stringify({ schema: 'vector-independent-model-oracle-cleanup-v1', status: 'released', ...measured.cleanup, artifactsDisposition: 'retained_for_physical_tensor_comparison', ownedBackgroundProcesses: 0 }, null, 2)}\n`);
  return { directory, ...reference, cleanup: measured.cleanup };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const args = parseArguments(process.argv.slice(2), ['candidate', 'output', 'runtime']); console.log(JSON.stringify(await runOracle({ candidateDirectory: args.candidate, outputDirectory: args.output, runtimeModule: args.runtime }), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
