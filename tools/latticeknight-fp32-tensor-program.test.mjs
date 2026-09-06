import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TensorProgram,
  TensorSession,
  compileTensorDeviceProgram,
} from 'cuda-js-tensor';

import {
  LATTICEKNIGHT_FP32_PROGRAM_PROFILE,
  buildLatticeKnightFp32TensorProgram,
} from './latticeknight-fp32-tensor-program.mjs';

const MIXED_CONTRACT = 'SPEC-0004-tensor-program-v1+SPEC-0010-erf-gather-concat-v1+SPEC-0011-tanh-v1';
const DEVICE_CONTRACT = 'SPEC-0009-item-parallel-device-tensor-program-v1+SPEC-0009-gather-concat-v1';

test('frozen LatticeKnight FP32 candidate constructs one exact public TensorProgram/TensorPlan', () => {
  const result = buildLatticeKnightFp32TensorProgram({ itemCapacity: 1 });

  assert.equal(result.profile, LATTICEKNIGHT_FP32_PROGRAM_PROFILE);
  assert.equal(result.itemCapacity, 1);
  assert.equal(result.parameterLayout.tensorCount, 227);
  assert.equal(result.parameterLayout.elementCount, 3_637_988);
  assert.equal(result.parameterLayout.byteLength, 14_551_952);
  assert.equal(result.program.contract, MIXED_CONTRACT);
  assert.equal(result.plan.contract, 'SPEC-0004-static-tensor-plan-v1');
  assert.deepEqual(result.program.inputs.map(({ name }) => name), ['features', 'parameters', 'constants']);
  assert.deepEqual(result.program.outputs.map(({ name, spec }) => ({ name, shape: [...spec.capacityShape], dtype: spec.dtype })), [
    { name: 'policy', shape: [1, 4162], dtype: 'f32' },
    { name: 'value', shape: [1, 1], dtype: 'f32' },
  ]);
  assert(result.program.nodes.length > 0 && result.program.nodes.length <= 4096);
  assert(Number.isSafeInteger(result.plan.totalDistinctBytes) && result.plan.totalDistinctBytes > 0);
  assert.equal(TensorProgram.create(JSON.parse(JSON.stringify(result.program.canonical))).compatibilityIdentity, result.program.compatibilityIdentity);
  assert.equal(result.program.nodes.some(({ op }) => op === 'fill'), false);
  const operations = new Set(result.program.nodes.map(({ op }) => op));
  for (const required of ['matmul', 'unary', 'binary', 'reduce', 'gather', 'concat', 'contiguous', 'reshape', 'permute', 'slice']) {
    assert(operations.has(required), `missing concrete operation ${required}`);
  }
  assert(result.program.nodes.some(({ op, options }) => op === 'unary' && options.operator === 'erf'));
  assert(result.program.nodes.some(({ op, options }) => op === 'unary' && options.operator === 'tanh'));
});

test('static distinct-resource accounting scales exactly with item capacity', () => {
  const one = buildLatticeKnightFp32TensorProgram({ itemCapacity: 1 });
  const two = buildLatticeKnightFp32TensorProgram({ itemCapacity: 2 });

  assert.equal(two.program.contract, MIXED_CONTRACT);
  assert.equal(two.program.nodes.length, one.program.nodes.length);
  assert.deepEqual(two.program.outputs.map(({ name, spec }) => ({ name, shape: [...spec.capacityShape], dtype: spec.dtype })), [
    { name: 'policy', shape: [2, 4162], dtype: 'f32' },
    { name: 'value', shape: [2, 1], dtype: 'f32' },
  ]);
  assert.equal(two.plan.totalDistinctBytes, one.plan.totalDistinctBytes * 2);
  assert.equal(two.plan.allocations.length, one.plan.allocations.length);
  for (let index = 0; index < one.plan.allocations.length; index += 1) {
    assert.equal(two.plan.allocations[index].byteLength, one.plan.allocations[index].byteLength * 2);
  }
});

test('root-public Tensor callable compilation owns exact item ABI and workspace', { timeout: 60_000 }, async () => {
  const result = buildLatticeKnightFp32TensorProgram({ itemCapacity: 1 });
  const session = await TensorSession.open();
  try {
    const deviceProgram = await compileTensorDeviceProgram(session, result.plan, {
      itemCapacity: 1,
      itemInputs: ['features'],
    });

    assert.equal(deviceProgram.contract, DEVICE_CONTRACT);
    assert.equal(deviceProgram.itemCapacity, 1);
    assert.deepEqual(deviceProgram.itemInputs, ['features']);
    assert.deepEqual(deviceProgram.inputs.map(({ name, itemVarying }) => [name, itemVarying]), [
      ['features', true],
      ['parameters', false],
      ['constants', false],
    ]);
    assert.deepEqual(deviceProgram.outputs.map(({ name, perItemElements }) => [name, perItemElements]), [
      ['policy', 4162],
      ['value', 1],
    ]);
    assert(Number.isSafeInteger(deviceProgram.totalWorkspaceBytes) && deviceProgram.totalWorkspaceBytes > 0);
    assert(deviceProgram.totalWorkspaceBytes <= 64 * 1024 * 1024);
    assert.equal(deviceProgram.workspace.length, 1);
    assert.equal(deviceProgram.workspace[0].dtype, 'f32');
    assert.equal(deviceProgram.workspace[0].byteLength, deviceProgram.totalWorkspaceBytes);
    assert.equal(deviceProgram.parameters.length, deviceProgram.function.parameters.length);
    assert(deviceProgram.parameters.length <= 64);
    assert.equal(deviceProgram.function.name, 'tensorRunItem');
    assert.equal(deviceProgram.function.returns, 'u32');
    assert.equal(deviceProgram.library.format, 'ptx');
    assert.equal(JSON.stringify(deviceProgram).includes('function tensorRunItem'), false);
    assert.equal(JSON.stringify(deviceProgram.canonical).includes('__device__'), false);
  } finally {
    const report = await session.close();
    assert.equal(report.graceful, true);
  }
});
