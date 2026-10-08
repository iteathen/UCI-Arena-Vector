import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileDeviceProgram, CUDA_JS_COMPATIBILITY, inspectDeviceProgram, openCudaRuntime } from 'cuda-js';
import { compileTensorDeviceProgram, CUDA_JS_TENSOR_COMPATIBILITY, TensorSession } from 'cuda-js-tensor';
import { buildLatticeKnightFp32TensorProgram } from './latticeknight-fp32-tensor-program.mjs';
import { compareFp32 } from './latticeknight-physical-observation.mjs';
import { assertNewEvidenceDirectory, parseArguments, sha256 } from './latticeknight-successor-candidate.mjs';
import { verifyGuardBytes } from './latticeknight-observation-checks.mjs';
export { verifyGuardBytes } from './latticeknight-observation-checks.mjs';

const floats = (values) => { const b = Buffer.alloc(values.length * 4); values.forEach((v, i) => b.writeFloatLE(v, i * 4)); return b; };

export async function runBlock32Model({ candidate, reference, calibration, output }) {
  if (process.version !== 'v26.11.1' || CUDA_JS_TENSOR_COMPATIBILITY.package.version !== '0.1.0-alpha.9' || CUDA_JS_COMPATIBILITY.package.version !== '0.1.0-alpha.21' || CUDA_JS_TENSOR_COMPATIBILITY.cudaJs.protectedMainRevision !== '2bff226b752d3c0af8b9185274d411e5990008d4') throw new Error('Block32 qualification exact cohort mismatch');
  const identity = JSON.parse(fs.readFileSync(new URL('../test/fixtures/model-successor/latticeknight-73091.json', import.meta.url)));
  const candidateManifest = JSON.parse(fs.readFileSync(path.join(candidate, 'candidate.json'))), oracle = JSON.parse(fs.readFileSync(path.join(reference, 'reference.json'))), ladder = JSON.parse(fs.readFileSync(calibration));
  if (candidateManifest.checkpointSha256 !== identity.checkpointSha256 || oracle.parameterSha256 !== identity.parameterSha256 || oracle.onnxSha256 !== identity.onnxSha256) throw new Error('Block32 model/oracle identity mismatch');
  const parameterBytes = fs.readFileSync(path.join(candidate, 'parameters.f32.bin'));
  if (sha256(parameterBytes) !== identity.parameterSha256) throw new Error('Block32 parameter identity mismatch');
  for (const batch of oracle.batches) for (const artifact of Object.values(batch.files)) if (sha256(fs.readFileSync(path.join(reference, artifact.file))) !== artifact.sha256) throw new Error('Independent oracle artifact mismatch');
  const built = buildLatticeKnightFp32TensorProgram({ itemCapacity: 2 });
  let macs = 0;
  for (const node of built.program.nodes) if (node.op === 'matmul') { const spec = built.program.valueSpec(node.inputIds[0]); macs += node.outputSpec.logicalElementCount * (node.options.transposeA ? spec.logicalShape[spec.rank - 2] : spec.logicalShape[spec.rank - 1]); }
  const measured = ladder.observations?.find((entry) => entry.scalarMacCount >= macs && entry.elapsedMilliseconds < 1500 && entry.guardedNoWrite && entry.participation?.kind === 'block32');
  if (!measured || ladder.tensorCompatibility?.package.version !== '0.1.0-alpha.9' || ladder.runtimeTerminal?.graceful !== true) throw new Error('No completed conservative block32 workload calibration covers the original model MAC count');
  const directory = assertNewEvidenceDirectory(output, [candidate, reference, path.dirname(calibration)]); fs.mkdirSync(path.dirname(directory), { recursive: true }); fs.mkdirSync(directory);
  const report = { schema: 'vector-real-successor-block32-model-observation-v1', node: process.version, tensorCompatibility: CUDA_JS_TENSOR_COMPATIBILITY, tensorArtifactSha256: '4355e93d78b3fc54888fdd43cb849349dcfd668d232154e79da8ff3d4ff836e2', checkpointSha256: identity.checkpointSha256, parameterSha256: identity.parameterSha256, onnxSha256: identity.onnxSha256, referenceSha256: sha256(fs.readFileSync(path.join(reference, 'reference.json'))), calibrationSha256: sha256(fs.readFileSync(calibration)), mapperSha256: sha256(fs.readFileSync(new URL('./latticeknight-fp32-tensor-program.mjs', import.meta.url))), programIdentity: built.program.compatibilityIdentity, planIdentity: built.plan.compatibilityIdentity, semanticNodeCount: built.program.nodes.length, twoItemScalarMacCount: macs, profile: 'SPEC-0009-block32-v1', calibration: measured, originalTolerances: { policy: identity.maximumPolicyAbsoluteError, value: identity.maximumValueAbsoluteError }, batches: [], cleanup: {}, completeEnginePipelineClaimed: false };
  fs.writeFileSync(path.join(directory, 'admission.json'), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify({ stage: 'admitted', scalarMacCount: macs, calibrationMacCount: measured.scalarMacCount, calibrationMilliseconds: measured.elapsedMilliseconds }));
  const compilerCache = path.resolve(path.dirname(directory), 'physical-block32-model-73091', 'compiler-cache');
  report.consumerPolicy = { maxDeviceBytes: 128 * 1024 * 1024, maxAllocationBytes: 64 * 1024 * 1024, maxTransferBytes: 64 * 1024 * 1024, maxModuleBytes: 64 * 1024 * 1024, maxArguments: 32, maxCompletionMilliseconds: 30000 };
  const runtime = await openCudaRuntime({ compiler: { cacheDirectory: compilerCache, cacheMode: 'read-write' }, driver: { memory: { maxDeviceBytes: report.consumerPolicy.maxDeviceBytes, maxAllocationBytes: report.consumerPolicy.maxAllocationBytes, maxTransferBytes: report.consumerPolicy.maxTransferBytes }, execution: { maxModuleBytes: report.consumerPolicy.maxModuleBytes, maxArguments: 32, maxCompletionMilliseconds: 30000 } } });
  let session, module, fn, operation, failure; const memories = [], views = [];
  try {
    report.runtime = await runtime.describe(); session = await TensorSession.open(runtime);
    console.log(JSON.stringify({ stage: 'compiling-original-block32-callable', semanticNodes: built.program.nodes.length }));
    const callable = await compileTensorDeviceProgram(session, built.plan, { itemCapacity: 2, itemInputs: ['features'], participation: 'block32' });
    report.callableIdentity = callable.compatibilityIdentity; report.callableContract = callable.contract; report.callable = callable.canonical;
    const publicLibrary = callable.library;
    fs.writeFileSync(path.join(directory, 'tensor-model-library.bin'), publicLibrary.artifact.bytes, { flag: 'wx' });
    fs.writeFileSync(path.join(directory, 'tensor-model-library.json'), `${JSON.stringify({ ...publicLibrary, artifact: { ...publicLibrary.artifact, bytes: undefined, bytesFile: 'tensor-model-library.bin' } }, null, 2)}\n`, { flag: 'wx' });
    report.libraryArtifact = { descriptorFile: 'tensor-model-library.json', bytesFile: 'tensor-model-library.bin', artifactSha256: publicLibrary.artifact.sha256, librarySha256: publicLibrary.sha256, format: publicLibrary.format, byteLength: publicLibrary.artifact.bytes.byteLength };
    callable.requireParticipation({ block: { x: 32, y: 1, z: 1 }, uniformItemIndex: true, uniformCall: true });
    const pointers = callable.parameters.slice(1);
    if (pointers.some((p) => p.byteLength + 32 > 64 * 1024 * 1024) || pointers.reduce((sum, p) => sum + p.byteLength + 32, 48) > 128 * 1024 * 1024) throw new Error('Callable resident allocation exceeds declared public policy');
    report.workspaceBytes = callable.totalWorkspaceBytes;
    const parameters = [...pointers.map((p) => ({ name: p.parameterName, type: p.type })), { name: 'statuses', type: 'ptr<u32>' }, { name: 'occupancy', type: 'u32' }];
    const source = `function evaluate(${parameters.map((p) => p.name).join(', ')}) { let group = gpu.block.x(); let item = group; if (group >= occupancy) { item = gpu.u32(2); } let status = evaluateItem(item, ${pointers.map((p) => p.parameterName).join(', ')}); if (gpu.thread.x() === gpu.u32(0)) { statuses[group] = status; } }`;
    const request = { source, functions: [{ name: 'evaluate', kind: 'kernel', parameters, returns: 'void' }], imports: [callable.importAs('evaluateItem')] };
    const inspected = inspectDeviceProgram(request); report.consumerInspection = inspected.inspection; report.consumerSourceSha256 = sha256(source);
    const compiled = await compileDeviceProgram(runtime, request); report.linkedProgramIdentity = compiled.deviceProgram.sha256; report.linkedArtifact = { sha256: compiled.linker.artifact.sha256, format: compiled.linker.artifact.format, architecture: compiled.linker.artifact.architecture, byteLength: compiled.linker.artifact.bytes.byteLength };
    if (report.linkedArtifact.byteLength > report.consumerPolicy.maxModuleBytes) throw new Error('Linked original model artifact exceeds the public bounded consumer module policy');
    fs.writeFileSync(path.join(directory, 'linked-model.cubin'), compiled.linker.artifact.bytes, { flag: 'wx' });
    console.log(JSON.stringify({ stage: 'linked-original-model', ...report.linkedArtifact, maxModuleBytes: report.consumerPolicy.maxModuleBytes }));
    module = await runtime.loadModule({ format: compiled.linker.artifact.format, bytes: compiled.linker.artifact.bytes });
    const kernel = compiled.deviceProgram.kernels.find((entry) => entry.name === 'evaluate'); fn = await module.getFunction({ name: kernel.functionName, parameters: kernel.parameters });
    const constants = floats(built.constantLayout.values); report.constantsSha256 = sha256(constants);
    for (const p of pointers) { const memory = await runtime.allocateDevice({ byteLength: p.byteLength + 32 }); memories.push(memory); views.push(await memory.view({ dtype: p.dtype, byteOffset: 16, elementCount: p.elementCount, access: p.access })); }
    const statusMemory = await runtime.allocateDevice({ byteLength: 48 }); memories.push(statusMemory); views.push(await statusMemory.view({ dtype: 'u32', byteOffset: 16, elementCount: 4, access: 'write' }));
    for (const batch of oracle.batches) {
      const seeds = { features: fs.readFileSync(path.join(reference, batch.files.features.file)), parameters: parameterBytes, constants };
      for (let i = 0; i < pointers.length; i++) { const p = pointers[i], bytes = Buffer.alloc(p.byteLength + 32, 0xa5); if (p.role === 'input') seeds[p.name].copy(bytes, 16); await memories[i].write(Uint8Array.from(bytes)); }
      await statusMemory.write(Uint8Array.from(Buffer.alloc(48, 0xa5)));
      console.log(JSON.stringify({ stage: 'executing-one-device-closed-inference-call', batch: batch.id, itemCount: batch.itemCount, block: { x: 32, y: 1, z: 1 }, gridBlocks: 4 }));
      const start = performance.now();
      operation = await fn.submit({ grid: { x: 4, y: 1, z: 1 }, block: { x: 32, y: 1, z: 1 }, arguments: [...views, batch.itemCount], accesses: [...pointers.map((p, argumentIndex) => ({ argumentIndex, byteOffset: 0, byteLength: p.byteLength, mode: p.access })), { argumentIndex: pointers.length, byteOffset: 0, byteLength: 16, mode: 'write' }] });
      const terminal = await operation.wait(); if (terminal.status !== 'completed') throw new Error('Native block32 model execution did not complete');
      const elapsedMilliseconds = performance.now() - start; await operation.close(); operation = null;
      const observed = {};
      for (let i = 0; i < pointers.length; i++) {
        const p = pointers[i], bytes = Buffer.from((await memories[i].read({ byteLength: p.byteLength + 32 })).bytes);
        verifyGuardBytes(bytes, p.byteLength, batch.itemCount === 1 && p.itemVarying && p.role !== 'input' ? p.byteLength / 2 : null);
        if (p.role === 'output') {
          const occupied = bytes.subarray(16, 16 + batch.itemCount * p.perItemElements * 4), expected = fs.readFileSync(path.join(reference, batch.files[p.name].file));
          const file = `${batch.id}.${p.name}.observed.f32.bin`; fs.writeFileSync(path.join(directory, file), occupied, { flag: 'wx' });
          observed[p.name] = { file, sha256: sha256(occupied), ...compareFp32(expected, occupied, p.name === 'policy' ? identity.maximumPolicyAbsoluteError : identity.maximumValueAbsoluteError) };
        }
      }
      const statusesBytes = Buffer.from((await statusMemory.read({ byteLength: 48 })).bytes); verifyGuardBytes(statusesBytes, 16);
      const statuses = Array.from({ length: 4 }, (_, i) => statusesBytes.readUInt32LE(16 + i * 4)), expectedStatuses = batch.itemCount === 2 ? [0, 0, 1, 1] : [0, 1, 1, 1];
      if (JSON.stringify(statuses) !== JSON.stringify(expectedStatuses)) throw new Error('Uniform item admission/status mismatch');
      const record = { id: batch.id, itemCapacity: 2, itemCount: batch.itemCount, featureSha256: batch.files.features.sha256, statuses, inputOutputWorkspaceGuardsPassed: true, inactiveItemNoWritePassed: batch.itemCount === 1, observed, elapsedMilliseconds, timingMeaning: 'one native submission to completed public wait; excludes compile/transfers', singleDeviceClosedInferenceInvocation: true, performanceClaim: 'exact measured invocation only' };
      report.batches.push(record); console.log(JSON.stringify({ stage: 'compared', ...record }));
      if (elapsedMilliseconds >= 1500) throw new Error('Full-model cooperative invocation exceeded conservative 1500 ms stop');
    }
  } catch (error) { failure = error; report.failure = { code: error.code ?? 'UNKNOWN', message: error.message, details: error.details ?? null }; }
  finally {
    const closes = [];
    if (operation) closes.push(['operation', () => operation.close()]); if (fn) closes.push(['function', () => fn.close()]); if (module) closes.push(['module', () => module.close()]);
    for (let i = views.length - 1; i >= 0; i--) closes.push([`view${i}`, () => views[i].close()]); for (let i = memories.length - 1; i >= 0; i--) closes.push([`memory${i}`, () => memories[i].close()]);
    if (session) closes.push(['session', () => session.close()]); closes.push(['runtime', () => runtime.close()]);
    for (const [name, close] of closes) { try { const terminal = await close(); report.cleanup[name] = terminal; if (terminal.graceful === false) failure ??= new Error(`${name} cleanup unproved`); } catch (error) { report.cleanup[name] = { graceful: false, message: error.message }; failure ??= error; } }
  }
  report.modelNumericalParityPassed = !failure && report.batches.length === 2 && report.batches.every((batch) => batch.observed.policy.pass && batch.observed.value.pass);
  report.status = failure ? 'execution_or_latency_failure' : report.modelNumericalParityPassed ? 'device_closed_inference_math_and_exact_latency_qualified' : 'original_numerical_tolerance_failure';
  fs.writeFileSync(path.join(directory, 'observation.json'), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  if (failure) throw failure;
  return { directory, status: report.status, modelNumericalParityPassed: report.modelNumericalParityPassed, batches: report.batches, cleanup: { session: report.cleanup.session?.graceful, runtime: report.cleanup.runtime?.graceful }, completeEnginePipelineClaimed: false };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(await runBlock32Model(parseArguments(process.argv.slice(2), ['candidate', 'reference', 'calibration', 'output'])), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
