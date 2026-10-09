import * as cuda from 'cuda-js';
import { createHash } from 'node:crypto';
import { STATE_FORMAT, STATE_WORDS, HEADER_WORDS } from '../chess-domain/admission.mjs';
import { buildModelInputProgram, FEATURE_COUNT, ACTION_CAPACITY } from './device.mjs';
export function inspectModelInputProgram() { return cuda.inspectDeviceProgram(buildModelInputProgram()); }

export async function qualifyModelInputs(rows, { featureCapacity } = {}) {
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 32) throw new Error('model input capsule requires 1..32 rows');
  const stateWords = new Uint32Array(rows.length * STATE_WORDS);
  const actions = new Uint32Array(rows.length * ACTION_CAPACITY);
  const actionCounts = new Uint32Array(rows.length);
  rows.forEach((row, i) => {
    if (row.state?.format !== STATE_FORMAT || !(row.state.words instanceof Uint32Array) || row.state.words.length !== STATE_WORDS || row.state.words[69] < 1 || row.state.words[69] > 256) throw new Error('model resident state format/extent/history invalid');
    if (!Array.isArray(row.actions) || row.actions.length > ACTION_CAPACITY || row.actions.some(x => !Number.isSafeInteger(x) || x < 0 || x > 0xffffffff)) throw new Error('policy mapping action extent/encoding invalid');
    stateWords.set(row.state.words, i * STATE_WORDS);
    actions.set(row.actions, i * ACTION_CAPACITY); actionCounts[i] = row.actions.length;
  });
  const features = new Float32Array(rows.length * FEATURE_COUNT + 2).fill(-7);
  const admittedCapacity = featureCapacity ?? features.length;
  if (!Number.isSafeInteger(admittedCapacity) || admittedCapacity < 0 || admittedCapacity > features.length) throw new Error('feature capacity exceeds backing extent');
  const byteSizes = [stateWords.byteLength, rows.length * HEADER_WORDS * 4, actions.byteLength, actionCounts.byteLength, features.byteLength, actions.byteLength, rows.length * 4];
  const runtime = await cuda.openCudaRuntime({ compiler: true, driver: { memory: { maxDeviceBytes: byteSizes.reduce((a, b) => a + b, 0), maxAllocationBytes: Math.max(...byteSizes), maxTransferBytes: Math.max(...byteSizes) }, execution: { maxArguments: 9, maxModuleBytes: 8_388_608, maxCompletionMilliseconds: 30_000 } } });
  const resources = []; let result, terminal, environment, artifact;
  try {
    environment = await runtime.describe();
    const program = buildModelInputProgram();
    const compiled = await cuda.compileDeviceProgram(runtime, program);
    artifact = { sha256: compiled.compiler.artifact.sha256, format: compiled.compiler.artifact.format, architecture: compiled.compiler.artifact.architecture };
    const memory = [];
    for (const byteLength of byteSizes) { const allocation = await runtime.allocateDevice({ byteLength }); memory.push(allocation); resources.push(allocation); }
    for (const [i, data] of [[0, stateWords], [2, actions], [3, actionCounts], [4, features]]) await memory[i].write(new Uint8Array(data.buffer));
    const module = await runtime.loadModule({ format: compiled.compiler.artifact.format, bytes: compiled.compiler.artifact.bytes }); resources.push(module);
    const kernel = compiled.deviceProgram.kernels.find(({ name }) => name === 'modelInput');
    const fn = await module.getFunction({ name: kernel.functionName, parameters: kernel.parameters }); resources.push(fn);
    const operation = await fn.submit({ grid: { x: rows.length, y: 1, z: 1 }, block: { x: 1, y: 1, z: 1 }, arguments: [...memory, rows.length, admittedCapacity], accesses: byteSizes.map((byteLength, argumentIndex) => ({ argumentIndex, byteOffset: 0, byteLength, mode: [2, 3].includes(argumentIndex) ? 'read' : [5, 6].includes(argumentIndex) ? 'write' : 'read-write' })) }); resources.push(operation);
    if ((await operation.wait()).status !== 'completed') throw new Error('model input operation did not complete');
    const featureRead = await memory[4].read({ byteLength: features.byteLength });
    const policyRead = await memory[5].read({ byteLength: actions.byteLength });
    const statusRead = await memory[6].read({ byteLength: rows.length * 4 });
    const actualFeatures = new Float32Array(featureRead.bytes.buffer, featureRead.bytes.byteOffset, features.length);
    const actualPolicy = new Int32Array(policyRead.bytes.buffer, policyRead.bytes.byteOffset, actions.length);
    const statuses = new Uint32Array(statusRead.bytes.buffer, statusRead.bytes.byteOffset, rows.length);
    result = { guardsIntact: actualFeatures[0] === -7 && actualFeatures.at(-1) === -7, rows: rows.map((_, i) => ({ status: statuses[i], features: actualFeatures.slice(1 + i * FEATURE_COUNT, 1 + (i + 1) * FEATURE_COUNT), policyIndices: Array.from(actualPolicy.slice(i * ACTION_CAPACITY, i * ACTION_CAPACITY + actionCounts[i])) })) };
  } finally {
    const errors = [];
    for (const resource of resources.reverse()) { try { await resource.close(); } catch (error) { errors.push(error); break; } }
    terminal = await runtime.close();
    if (errors.length || !terminal.graceful) throw new AggregateError(errors, 'model input cleanup unproved');
  }
  return { ...result, environment, artifact, sourceIdentity: createHash('sha256').update(buildModelInputProgram().source).digest('hex'), terminal };
}
