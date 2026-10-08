import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CUDA_JS_COMPATIBILITY, openCudaRuntime } from 'cuda-js';
import { openCudaRuntimeForTesting } from 'cuda-js/testing';
import { CUDA_JS_TENSOR_COMPATIBILITY, resolveTensorPlan, TensorProgram, TensorSession } from 'cuda-js-tensor';
import { buildLatticeKnightFp32TensorProgram } from './latticeknight-fp32-tensor-program.mjs';
import { assertNewEvidenceDirectory, parseArguments, sha256 } from './latticeknight-successor-candidate.mjs';

export function compareFp32(expected, observed, tolerance) {
  if (expected.length !== observed.length || expected.length % 4) throw new Error('Numerical observation length mismatch');
  if (!Number.isFinite(tolerance) || tolerance < 0) throw new Error('Invalid numerical tolerance');
  let maximumAbsoluteError = 0, firstDivergence = null;
  for (let offset = 0; offset < expected.length; offset += 4) {
    const want = expected.readFloatLE(offset), got = observed.readFloatLE(offset);
    if (!Number.isFinite(want) || !Number.isFinite(got)) throw new Error('Nonfinite numerical observation');
    const error = Math.abs(want - got); maximumAbsoluteError = Math.max(maximumAbsoluteError, error);
    if (error > tolerance && !firstDivergence) firstDivergence = { index: offset / 4, expected: want, observed: got, absoluteError: error };
  }
  return { pass: !firstDivergence, tolerance, maximumAbsoluteError, firstDivergence };
}
const SESSION_LIMITS = Object.freeze({ maxLiveTensors: 4096, maxSessionBytes: 256 * 1024 * 1024, maxTensorBytes: 128 * 1024 * 1024 });

export async function preflightPhysicalModel() {
  const built = buildLatticeKnightFp32TensorProgram({ itemCapacity: 2 });
  const inputBytes = built.program.inputs.reduce((sum, input) => sum + input.spec.byteLength, 0);
  const report = { profile: 'qualification-only-public-host-plan-simt-v1', engineActiveInferenceProfileClaimed: false, itemCapacity: 2, programIdentity: built.program.compatibilityIdentity, planIdentity: built.plan.compatibilityIdentity, semanticNodeCount: built.program.nodes.length, materialBytes: built.plan.totalDistinctBytes, inputBytes, requiredTensorCount: built.plan.allocations.length + built.program.inputs.length, sessionLimits: SESSION_LIMITS, publicPreparedLimits: CUDA_JS_COMPATIBILITY.capabilities.preparedOperationDagLimits, admitted: false, gpuWorkStarted: false };
  if (built.plan.totalDistinctBytes + inputBytes > SESSION_LIMITS.maxSessionBytes || report.requiredTensorCount > SESSION_LIMITS.maxLiveTensors) { report.failure = { code: 'VECTOR_QUALIFICATION_SESSION_LIMIT' }; return report; }
  const runtime = await openCudaRuntimeForTesting({ compiler: true });
  let session, resolved;
  try {
    session = await TensorSession.open({ runtime, limits: SESSION_LIMITS });
    resolved = await resolveTensorPlan(session, built.plan, { backend: 'simt', fusion: 'none' });
    report.admitted = true;
    report.resolvedIdentity = resolved.compatibilityIdentity;
  } catch (error) { report.failure = { code: error.code ?? 'UNKNOWN', message: error.message, details: error.details ?? null }; }
  finally {
    if (resolved) await resolved.close();
    const sessionTerminal = session ? await session.close() : null, runtimeTerminal = await runtime.close();
    report.cleanup = { sessionGraceful: sessionTerminal?.graceful ?? null, runtimeGraceful: runtimeTerminal.graceful, compilerProgramsCreated: runtimeTerminal.compiler?.resources?.programsCreated ?? null, compilerCleanupClaim: runtimeTerminal.compiler?.cleanupClaim ?? null, driverCleanupClaim: runtimeTerminal.driver?.cleanupClaim ?? null };
  }
  return report;
}

function floatBytes(values) { const bytes = Buffer.alloc(values.length * 4); values.forEach((v, i) => bytes.writeFloatLE(v, i * 4)); return bytes; }
export async function runNativePreview() {
  const runtime = await openCudaRuntime({ compiler: true, driver: { memory: { maxDeviceBytes: 32 * 1024 * 1024, maxAllocationBytes: 8 * 1024 * 1024, maxTransferBytes: 8 * 1024 * 1024 }, execution: { maxModuleBytes: 4 * 1024 * 1024, maxArguments: 32, maxCompletionMilliseconds: 30000 } } });
  let session, resolved, result; const inputs = {}, cleanup = {}; let failure;
  const preview = { profile: 'generic-public-native-matmul-preview-v1', modelNumericalParityClaimed: false, hostPlanQualificationOnly: true };
  try {
    preview.runtime = await runtime.describe();
    session = await TensorSession.open({ runtime, limits: SESSION_LIMITS });
    const program = TensorProgram.define((graph) => graph.matmul(graph.input('left', { dtype: 'f32', capacityShape: [2, 3], access: 'read-write' }), graph.input('right', { dtype: 'f32', capacityShape: [3, 2], access: 'read-write' })));
    resolved = await resolveTensorPlan(session, program, { backend: 'simt', fusion: 'none' });
    preview.programIdentity = program.compatibilityIdentity; preview.resolvedIdentity = resolved.compatibilityIdentity;
    preview.compiler = resolved.canonical.backendDescriptor.compiler; preview.deviceProgram = resolved.canonical.backendDescriptor.deviceProgram;
    preview.kernelCount = resolved.kernelCount; preview.workspaceBytes = resolved.workspaceBytes;
    const data = { left: floatBytes([1, 2, 3, 4, 5, 6]), right: floatBytes([7, 8, 9, 10, 11, 12]) };
    for (const input of program.inputs) {
      inputs[input.name] = await session.allocate(input.spec);
      await inputs[input.name].write(data[input.name]);
    }
    result = await resolved.run(inputs);
    const observed = Buffer.from((await result.output.read()).bytes);
    preview.output = Array.from({ length: 4 }, (_, index) => observed.readFloatLE(index * 4));
    preview.outputSha256 = sha256(observed); preview.comparison = compareFp32(floatBytes([58, 64, 139, 154]), observed, 0);
    if (!preview.comparison.pass) throw new Error('Native preview numerical mismatch');
  } catch (error) { failure = error; }
  finally {
    const closes = [];
    if (result) closes.push(['result', () => result.close()]);
    if (resolved) closes.push(['resolved', () => resolved.close()]);
    for (const [name, input] of Object.entries(inputs).reverse()) closes.push([name, () => input.close()]);
    if (session) closes.push(['session', () => session.close()]);
    closes.push(['runtime', () => runtime.close()]);
    for (const [name, close] of closes) {
      try { const terminal = await close(); cleanup[name] = terminal; if (terminal.graceful === false) failure ??= new Error(`${name} cleanup unproved`); }
      catch (error) { cleanup[name] = { graceful: false, failure: error.message }; failure ??= error; }
    }
  }
  preview.cleanup = cleanup;
  if (failure) { failure.preview = preview; throw failure; }
  return preview;
}

export async function runPhysicalObservation({ candidate, reference, output }) {
  if (process.version !== 'v26.11.1') throw new Error('Physical observation requires exact Node v26.11.1');
  if (CUDA_JS_TENSOR_COMPATIBILITY.package.version !== '0.1.0-alpha.7' || CUDA_JS_TENSOR_COMPATIBILITY.cudaJs.protectedMainRevision !== '2bff226b752d3c0af8b9185274d411e5990008d4' || CUDA_JS_COMPATIBILITY.package.version !== '0.1.0-alpha.21') throw new Error('Physical observation exact public cohort mismatch');
  const manifest = JSON.parse(fs.readFileSync(path.join(candidate, 'candidate.json'))), oracle = JSON.parse(fs.readFileSync(path.join(reference, 'reference.json')));
  if (manifest.parameterSha256 !== oracle.parameterSha256 || sha256(fs.readFileSync(path.join(candidate, 'parameters.f32.bin'))) !== oracle.parameterSha256) throw new Error('Physical observation parameter identity mismatch');
  for (const batch of oracle.batches) for (const artifact of Object.values(batch.files)) if (sha256(fs.readFileSync(path.join(reference, artifact.file))) !== artifact.sha256) throw new Error('Independent reference identity mismatch');
  const directory = assertNewEvidenceDirectory(output, [candidate, reference]); fs.mkdirSync(path.dirname(directory), { recursive: true }); fs.mkdirSync(directory);
  const preflight = await preflightPhysicalModel();
  let preview;
  try { preview = await runNativePreview(); }
  catch (error) { fs.writeFileSync(path.join(directory, 'preview-failure.json'), JSON.stringify(error.preview, null, 2)); throw error; }
  const report = { schema: 'vector-physical-host-plan-model-observation-v1', node: process.version, tensorCompatibility: CUDA_JS_TENSOR_COMPATIBILITY, parameterSha256: manifest.parameterSha256, referenceSha256: sha256(fs.readFileSync(path.join(reference, 'reference.json'))), originalTolerances: { policy: manifest.maximumPolicyAbsoluteError, value: manifest.maximumValueAbsoluteError }, preflight, preview, modelObservationStatus: preflight.admitted ? 'admitted_pending_full_model_execution' : 'blocked_by_public_prepared_plan_limit_before_gpu', modelNumericalParityClaimed: false, engineActiveInferenceProfileClaimed: false, ownerRoute: preflight.admitted ? null : 'CUDA-JS-Tensor generic public host-plan realization under CUDA-JS finite prepared-DAG limits', generatedArtifactsDisposition: 'retained_for_owner_routing_and_resume' };
  fs.writeFileSync(path.join(directory, 'observation.json'), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  return { directory, modelObservationStatus: report.modelObservationStatus, failure: preflight.failure, preview: { output: preview.output, comparison: preview.comparison }, modelNumericalParityClaimed: false };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(await runPhysicalObservation(parseArguments(process.argv.slice(2), ['candidate', 'reference', 'output'])), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
