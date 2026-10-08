import { createHash } from 'node:crypto';
import * as cuda from 'cuda-js';
import { buildDomainProgram } from './device.mjs';
import { HEADER_WORDS, STATE_WORDS, RESULT_WORDS, MAX_ACTIONS } from './admission.mjs';

export function inspectDomainProgram() { return cuda.inspectDeviceProgram(buildDomainProgram()); }

export async function qualifyDomain(admitted, { capacity = MAX_ACTIONS } = {}) {
  if (!Array.isArray(admitted) || admitted.length < 1 || admitted.length > 32) throw new Error('Domain capsule requires 1..32 independently admitted positions');
  if (!Number.isSafeInteger(capacity) || capacity < 0 || capacity > MAX_ACTIONS) throw new Error('Domain action capacity must be 0..256');
  for (const input of admitted) {
    if (input?.format !== 'vector.chess-mailbox-u32/1.0.0' || !(input.words instanceof Uint32Array) || input.words.length !== STATE_WORDS) throw new Error('Domain resident state format/extent mismatch');
  }
  // Every position is an independent terminal Domain qualification operation.
  // Reuse allocations between completed cases; never drive an active search.
  const inputByteLength = STATE_WORDS * 4;
  const outputBytes = RESULT_WORDS * 4;
  const scratchBytes = HEADER_WORDS * 4;
  const runtime = await cuda.openCudaRuntime({ compiler: true, driver: {
    memory: { maxDeviceBytes: inputByteLength + outputBytes + scratchBytes, maxAllocationBytes: outputBytes, maxTransferBytes: outputBytes },
    execution: { maxModuleBytes: 8_388_608, maxArguments: 5, maxCompletionMilliseconds: 30_000 },
  } });
  const resources = [];
  let terminal, environment, artifact, returned;
  try {
    environment = await runtime.describe();
    const compiled = await cuda.compileDeviceProgram(runtime, buildDomainProgram());
    artifact = { sha256: compiled.compiler.artifact.sha256, format: compiled.compiler.artifact.format, architecture: compiled.compiler.artifact.architecture };
    const states = await runtime.allocateDevice({ byteLength: inputByteLength }); resources.push(states);
    const scratch = await runtime.allocateDevice({ byteLength: scratchBytes }); resources.push(scratch);
    const output = await runtime.allocateDevice({ byteLength: outputBytes }); resources.push(output);
    const module = await runtime.loadModule({ format: compiled.compiler.artifact.format, bytes: compiled.compiler.artifact.bytes }); resources.push(module);
    const kernel = compiled.deviceProgram.kernels.find(({ name }) => name === 'chessDomain');
    const fn = await module.getFunction({ name: kernel.functionName, parameters: kernel.parameters }); resources.push(fn);
    returned = [];
    for (const position of admitted) {
      await states.write(new Uint8Array(position.words.buffer, position.words.byteOffset, position.words.byteLength));
      const operation = await fn.submit({ grid: { x: 1, y: 1, z: 1 }, block: { x: 1, y: 1, z: 1 }, arguments: [states, scratch, output, 1, capacity], accesses: [
        { argumentIndex: 0, byteOffset: 0, byteLength: inputByteLength, mode: 'read-write' },
        { argumentIndex: 1, byteOffset: 0, byteLength: scratchBytes, mode: 'read-write' },
        { argumentIndex: 2, byteOffset: 0, byteLength: outputBytes, mode: 'write' },
      ] }); resources.push(operation);
      const completion = await operation.wait();
      if (completion.status !== 'completed') throw new Error(`Domain operation ended with ${completion.status}`);
      const read = await output.read({ byteLength: outputBytes });
      const words = new Uint32Array(read.bytes.buffer, read.bytes.byteOffset, outputBytes / 4);
      const base = 0;
      const status = words[base], count = words[base + 1];
      if (count > capacity || count > MAX_ACTIONS || (status !== 0 && count !== 0)) throw new Error('Domain result bounds/status violated');
      returned.push({ status, inCheck: words[base + 2] === 1, terminal: words[base + 3], repetitions: words[base + 4], halfmove: words[base + 5], identityKey: words[base + 6], moves: Array.from({ length: count }, (_, i) => {
        const slot = base + 8 + i * (STATE_WORDS + 1);
        return { action: words[slot], state: words.slice(slot + 1, slot + 1 + STATE_WORDS) };
      }) });
      await operation.close(); resources.pop();
    }
  } finally {
    const failures = [];
    for (const resource of resources.reverse()) { try { await resource.close(); } catch (error) { failures.push(error); break; } }
    terminal = await runtime.close();
    if (failures.length || !terminal.graceful) throw new AggregateError(failures, 'Domain cleanup unproved; runtime terminal must be examined');
  }
  return { results: returned, environment, artifact, sourceIdentity: createHash('sha256').update(buildDomainProgram().source).digest('hex'), terminal };
}

export async function qualifyIdentity(left, right) {
  for (const value of [left, right]) if (value?.format !== 'vector.chess-mailbox-u32/1.0.0' || !(value.words instanceof Uint32Array) || value.words.length !== STATE_WORDS) throw new Error('Domain resident state format/extent mismatch');
  const runtime = await cuda.openCudaRuntime({ compiler: true, driver: { memory: { maxDeviceBytes: STATE_WORDS * 8 + 16, maxAllocationBytes: STATE_WORDS * 4, maxTransferBytes: STATE_WORDS * 4 }, execution: { maxArguments: 3, maxCompletionMilliseconds: 30_000 } } });
  const resources = [];
  let words, terminal;
  try {
    const compiled = await cuda.compileDeviceProgram(runtime, buildDomainProgram());
    const a = await runtime.allocateDevice({ byteLength: STATE_WORDS * 4 }); resources.push(a);
    const b = await runtime.allocateDevice({ byteLength: STATE_WORDS * 4 }); resources.push(b);
    const out = await runtime.allocateDevice({ byteLength: 16 }); resources.push(out);
    await a.write(new Uint8Array(left.words.buffer, left.words.byteOffset, left.words.byteLength));
    await b.write(new Uint8Array(right.words.buffer, right.words.byteOffset, right.words.byteLength));
    const module = await runtime.loadModule({ format: compiled.compiler.artifact.format, bytes: compiled.compiler.artifact.bytes }); resources.push(module);
    const kernel = compiled.deviceProgram.kernels.find(({ name }) => name === 'chessIdentity');
    const fn = await module.getFunction({ name: kernel.functionName, parameters: kernel.parameters }); resources.push(fn);
    const operation = await fn.submit({ grid: { x: 1, y: 1, z: 1 }, block: { x: 1, y: 1, z: 1 }, arguments: [a, b, out], accesses: [
      { argumentIndex: 0, byteOffset: 0, byteLength: STATE_WORDS * 4, mode: 'read' },
      { argumentIndex: 1, byteOffset: 0, byteLength: STATE_WORDS * 4, mode: 'read' },
      { argumentIndex: 2, byteOffset: 0, byteLength: 16, mode: 'write' },
    ] }); resources.push(operation);
    if ((await operation.wait()).status !== 'completed') throw new Error('Domain identity operation did not complete');
    const read = await out.read({ byteLength: 16 });
    words = new Uint32Array(read.bytes.buffer, read.bytes.byteOffset, 4).slice();
  } finally {
    const failures = [];
    for (const resource of resources.reverse()) { try { await resource.close(); } catch (error) { failures.push(error); break; } }
    terminal = await runtime.close();
    if (failures.length || !terminal.graceful) throw new AggregateError(failures, 'Domain identity cleanup unproved');
  }
  return { status: words[0], leftKey: words[1], rightKey: words[2], equal: words[3] === 1, terminal };
}
