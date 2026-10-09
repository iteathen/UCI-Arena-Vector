import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CUDA_JS_COMPATIBILITY, openCudaRuntime } from 'cuda-js';
import { openCudaRuntimeForTesting } from 'cuda-js/testing';
import { CUDA_JS_TENSOR_COMPATIBILITY, resolveTensorPlan, TensorProgram, TensorSession, TensorSpec } from 'cuda-js-tensor';
import { buildLatticeKnightFp32TensorProgram } from './latticeknight-fp32-tensor-program.mjs';
import { assertNewEvidenceDirectory, parseArguments, sha256 } from './latticeknight-successor-candidate.mjs';
import { compareFp32 } from './latticeknight-observation-checks.mjs';
export { compareFp32 } from './latticeknight-observation-checks.mjs';

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
export async function runResidentModelObservation({ candidate, reference, output }) {
  if (process.version !== 'v26.11.1') throw new Error('Resident physical qualification requires exact Node v26.11.1');
  if (CUDA_JS_TENSOR_COMPATIBILITY.package.version !== '0.1.0-alpha.8' || CUDA_JS_TENSOR_COMPATIBILITY.cudaJs.protectedMainRevision !== '2bff226b752d3c0af8b9185274d411e5990008d4' || CUDA_JS_COMPATIBILITY.package.version !== '0.1.0-alpha.21') throw new Error('Resident physical qualification exact public cohort mismatch');
  const manifest = JSON.parse(fs.readFileSync(path.join(candidate, 'candidate.json'))), oracle = JSON.parse(fs.readFileSync(path.join(reference, 'reference.json')));
  const frozen = JSON.parse(fs.readFileSync(new URL('../test/fixtures/model-successor/latticeknight-73091.json', import.meta.url)));
  if (manifest.checkpointSha256 !== frozen.checkpointSha256 || manifest.parameterSha256 !== frozen.parameterSha256 || oracle.parameterSha256 !== frozen.parameterSha256 || oracle.onnxSha256 !== frozen.onnxSha256) throw new Error('Resident model/reference identity mismatch');
  const parameters = fs.readFileSync(path.join(candidate, 'parameters.f32.bin'));
  if (sha256(parameters) !== frozen.parameterSha256) throw new Error('Resident parameter bytes identity mismatch');
  for (const batch of oracle.batches) for (const artifact of Object.values(batch.files)) if (sha256(fs.readFileSync(path.join(reference, artifact.file))) !== artifact.sha256) throw new Error('Independent reference bytes identity mismatch');
  const built = buildLatticeKnightFp32TensorProgram({ itemCapacity: 2 });
  const inputBytes = built.program.inputs.reduce((sum, input) => sum + input.spec.byteLength, 0), reductions = built.program.nodes.filter((node) => node.op === 'reduce').length;
  const admission = { inputBytes, materialBytes: built.plan.totalDistinctBytes, materialCount: built.plan.allocations.length, reductionWorkspaceCountUpperBound: reductions, workspaceByteCeiling: 64 * 1024 * 1024, sessionLimits: SESSION_LIMITS, publicPreparedLimits: CUDA_JS_COMPATIBILITY.capabilities.preparedOperationDagLimits };
  if (admission.materialBytes + inputBytes + admission.workspaceByteCeiling > SESSION_LIMITS.maxSessionBytes || admission.materialCount + reductions + built.program.inputs.length * 2 > SESSION_LIMITS.maxLiveTensors || [...built.plan.allocations, ...built.program.inputs.map((entry) => ({ byteLength: entry.spec.byteLength }))].some((entry) => entry.byteLength > SESSION_LIMITS.maxTensorBytes)) throw new Error('Resident whole-plan memory admission failed before compiler work');
  const directory = assertNewEvidenceDirectory(output, [candidate, reference]); fs.mkdirSync(path.dirname(directory), { recursive: true }); fs.mkdirSync(directory);
  const writeJson = (file, value) => fs.writeFileSync(path.join(directory, file), `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
  const report = { schema: 'vector-real-successor-resident-model-observation-v1', node: process.version, tensorCompatibility: CUDA_JS_TENSOR_COMPATIBILITY, tensorArtifactSha256: '15f3ced369261d70c5e8c427040a598959b57005f1d9b058dff795b1af8b8e96', checkpointSha256: frozen.checkpointSha256, parameterSha256: frozen.parameterSha256, onnxSha256: frozen.onnxSha256, referenceSha256: sha256(fs.readFileSync(path.join(reference, 'reference.json'))), mapperSha256: sha256(fs.readFileSync(new URL('./latticeknight-fp32-tensor-program.mjs', import.meta.url))), programIdentity: built.program.compatibilityIdentity, planIdentity: built.plan.compatibilityIdentity, semanticNodeCount: built.program.nodes.length, profile: 'qualification-host-resident-sequence-v1', admission, originalTolerances: { policy: frozen.maximumPolicyAbsoluteError, value: frozen.maximumValueAbsoluteError }, batches: [], cleanup: {}, engineActiveInferenceProfileClaimed: false, performanceClaimed: false };
  writeJson('admission.json', report);
  console.log(JSON.stringify({ stage: 'admitted-before-compiler', semanticNodes: report.semanticNodeCount, ...admission }));
  const preview = await runNativePreview(); writeJson('preview.json', preview);
  const runtime = await openCudaRuntime({ compiler: { cacheDirectory: path.join(directory, 'compiler-cache'), cacheMode: 'read-write' }, driver: { memory: { maxDeviceBytes: SESSION_LIMITS.maxSessionBytes, maxAllocationBytes: 64 * 1024 * 1024, maxTransferBytes: 64 * 1024 * 1024 }, execution: { maxModuleBytes: 4 * 1024 * 1024, maxArguments: 32, maxCompletionMilliseconds: 30000 } } });
  let session, resolved, failure; const bases = [], views = [], inputs = {};
  try {
    report.runtime = await runtime.describe();
    session = await TensorSession.open({ runtime, limits: SESSION_LIMITS });
    console.log(JSON.stringify({ stage: 'resolving-original-model', execution: 'resident-sequence', kernelBoundsPerChunk: admission.publicPreparedLimits }));
    resolved = await resolveTensorPlan(session, built.plan, { execution: 'resident-sequence', backend: 'simt', fusion: 'none' });
    report.resolvedIdentity = resolved.compatibilityIdentity; report.resolvedContract = resolved.contract; report.backendDescriptor = resolved.canonical.backendDescriptor; report.kernelCount = resolved.kernelCount; report.bindingCount = resolved.bindingCount; report.workspaceBytes = resolved.workspaceBytes;
    console.log(JSON.stringify({ stage: 'resolved', kernelCount: resolved.kernelCount, bindingCount: resolved.bindingCount, workspaceBytes: resolved.workspaceBytes, chunkCount: report.backendDescriptor.chunkCount }));
    const constants = floatBytes(built.constantLayout.values);
    report.constantSha256 = sha256(constants);
    for (const input of built.program.inputs) {
      const spec = input.spec;
      const base = await session.allocate(TensorSpec.create({ dtype: spec.dtype, capacityShape: spec.capacityShape, strides: spec.strides, byteOffset: spec.byteOffset, alignment: spec.alignment, activeAxis0: spec.activeAxis0, aliasGroup: spec.aliasGroup, access: 'read-write' }));
      bases.push(base); inputs[input.name] = await base.view(spec); views.push(inputs[input.name]);
      if (input.name === 'parameters') await base.write(parameters);
      if (input.name === 'constants') await base.write(constants);
    }
    const featureBase = bases[built.program.inputs.findIndex((input) => input.name === 'features')];
    for (const batch of oracle.batches) {
      const featureBytes = fs.readFileSync(path.join(reference, batch.files.features.file));
      const padded = Buffer.alloc(built.program.inputs.find((input) => input.name === 'features').spec.byteLength); featureBytes.copy(padded);
      await featureBase.write(padded);
      console.log(JSON.stringify({ stage: 'executing', batch: batch.id, itemCount: batch.itemCount, hostCapacity: 2, inactiveHostSlotsZeroPadded: 2 - batch.itemCount }));
      const result = await resolved.run(inputs); let resultClosed = false;
      try {
        const observed = {};
        for (const [name, width] of [['policy', 4162], ['value', 1]]) {
          const bytes = Buffer.from((await result.get(name).read()).bytes).subarray(0, batch.itemCount * width * 4);
          fs.writeFileSync(path.join(directory, `${batch.id}.${name}.observed.f32.bin`), bytes, { flag: 'wx' });
          const expected = fs.readFileSync(path.join(reference, batch.files[name].file));
          observed[name] = { file: `${batch.id}.${name}.observed.f32.bin`, sha256: sha256(bytes), byteLength: bytes.length, ...compareFp32(expected, bytes, name === 'policy' ? frozen.maximumPolicyAbsoluteError : frozen.maximumValueAbsoluteError) };
        }
        report.batches.push({ id: batch.id, itemCapacity: 2, itemCount: batch.itemCount, inputSha256: batch.files.features.sha256, paddedHostInputSha256: sha256(padded), inactiveHostSlotsZeroPadded: 2 - batch.itemCount, inactiveNoWriteGuardClaimed: false, observed, execution: result.execution });
        console.log(JSON.stringify({ stage: 'compared', batch: batch.id, policy: observed.policy, value: observed.value }));
      } finally { const terminal = await result.close(); resultClosed = terminal.graceful; if (!resultClosed) throw new Error('Model result cleanup unproved'); }
    }
  } catch (error) { failure = error; report.failure = { code: error.code ?? 'UNKNOWN', message: error.message, details: error.details ?? null }; }
  finally {
    const closes = [];
    if (resolved) closes.push(['resolved', () => resolved.close()]);
    for (let i = views.length - 1; i >= 0; i--) closes.push([`inputView${i}`, () => views[i].close()]);
    for (let i = bases.length - 1; i >= 0; i--) closes.push([`inputBase${i}`, () => bases[i].close()]);
    if (session) closes.push(['session', () => session.close()]);
    closes.push(['runtime', () => runtime.close()]);
    for (const [name, close] of closes) {
      try { const terminal = await close(); report.cleanup[name] = terminal; if (terminal.graceful === false) failure ??= new Error(`${name} cleanup unproved`); }
      catch (error) { report.cleanup[name] = { graceful: false, failure: error.message }; failure ??= error; }
    }
  }
  report.modelNumericalParityPassed = !failure && report.batches.length === 2 && report.batches.every((batch) => batch.observed.policy.pass && batch.observed.value.pass);
  report.modelObservationStatus = failure ? 'execution_failed' : report.modelNumericalParityPassed ? 'original_fp32_mathematical_tolerances_passed_host_qualification_only' : 'numerical_tolerance_failure';
  writeJson('observation.json', report);
  if (failure) { failure.evidenceDirectory = directory; throw failure; }
  return { directory, modelObservationStatus: report.modelObservationStatus, modelNumericalParityPassed: report.modelNumericalParityPassed, batches: report.batches.map(({ id, observed }) => ({ id, observed })), cleanup: { session: report.cleanup.session?.graceful, runtime: report.cleanup.runtime?.graceful }, engineActiveInferenceProfileClaimed: false };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(await runResidentModelObservation(parseArguments(process.argv.slice(2), ['candidate', 'reference', 'output'])), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
