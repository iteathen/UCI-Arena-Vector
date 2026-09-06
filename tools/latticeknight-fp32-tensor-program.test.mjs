import assert from 'node:assert/strict';
import test from 'node:test';

import { openCudaRuntimeForTesting } from 'cuda-js/testing';
import {
  CUDA_JS_TENSOR_COMPATIBILITY,
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
const PROGRAM_IDENTITY = 'tensor-program-v1:3ef2b2fafdc3bbfa8b676668198b6f1bc91f0657adb3d04bf8e0a3c2d3644358';
const PLAN_IDENTITY = 'tensor-plan-v1:ae83f14f81e5417aed2695f1153266470370d6aecb6c3f6114ab50c201a13dba';
const DEVICE_PROGRAM_IDENTITY = 'tensor-device-program-v1:70d86fd70c97d8b585eb89a9a1cace19572f1d1fe27df11e155f9ce355eed2fb';
const WORKSPACE_BYTES_PER_ITEM = 33_194_524;
const WORKSPACE_ELEMENTS_PER_ITEM = 8_298_631;
const QUALIFICATION_ITEM_CAPACITY = 2;
const QUALIFICATION_WORKSPACE_BYTES = 66_389_048;
const DEFAULT_DEVICE_WORKSPACE_LIMIT = 67_108_864;
const PLAN_UNRESOLVED = [
  'runtime-input-aliasing',
  'session-device-compatibility',
  'backend-selection',
  'generated-program-identities',
  'backend-workspace',
  'prepared-execution-products',
  'cleanup-graph',
];

function countBy(records, selector) {
  const counts = new Map();
  for (const record of records) {
    const key = selector(record);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right));
}

test('frozen LatticeKnight FP32 candidate constructs one exact public TensorProgram/TensorPlan', () => {
  const result = buildLatticeKnightFp32TensorProgram({ itemCapacity: 1 });

  assert.equal(result.profile, LATTICEKNIGHT_FP32_PROGRAM_PROFILE);
  assert.equal(result.itemCapacity, 1);
  assert.equal(result.parameterLayout.tensorCount, 227);
  assert.equal(result.parameterLayout.elementCount, 3_637_988);
  assert.equal(result.parameterLayout.byteLength, 14_551_952);
  assert.deepEqual(
    [0, 2, 211, 213, 219, 226].map((index) => {
      const entry = result.parameterLayout.entries[index];
      return {
        storageIndex: entry.storageIndex,
        name: entry.name,
        shape: [...entry.shape],
        elementOffset: entry.elementOffset,
        elementCount: entry.elementCount,
        byteOffset: entry.byteOffset,
        byteLength: entry.byteLength,
      };
    }),
    [
      { storageIndex: 0, name: 'token_projection.weight', shape: [256, 17], elementOffset: 0, elementCount: 4352, byteOffset: 0, byteLength: 17_408 },
      { storageIndex: 2, name: 'gab_shared_templates', shape: [4096, 32], elementOffset: 4608, elementCount: 131_072, byteOffset: 18_432, byteLength: 524_288 },
      { storageIndex: 211, name: 'encoder.final_norm.weight', shape: [256], elementOffset: 3_521_856, elementCount: 256, byteOffset: 14_087_424, byteLength: 1024 },
      { storageIndex: 213, name: 'policy.source.weight', shape: [128, 256], elementOffset: 3_522_368, elementCount: 32_768, byteOffset: 14_089_472, byteLength: 131_072 },
      { storageIndex: 219, name: 'policy.promotion_delta.weight', shape: [3, 32], elementOffset: 3_604_352, elementCount: 96, byteOffset: 14_417_408, byteLength: 384 },
      { storageIndex: 226, name: 'value.output.bias', shape: [1], elementOffset: 3_637_987, elementCount: 1, byteOffset: 14_551_948, byteLength: 4 },
    ],
  );
  assert.deepEqual(result.constantLayout.entries.map(({ name, index, value }) => [name, index, value]), [
    ['zero', 0, 0],
    ['one', 1, 1],
    ['two', 2, 2],
    ['sqrt2', 3, 1.4142135381698608],
    ['layerNormEpsilon', 4, 0.000009999999747378752],
    ['width32', 5, 32],
    ['width64', 6, 64],
    ['width256', 7, 256],
    ['attentionScale', 8, 5.656854152679443],
    ['policyScale', 9, 11.313708305358887],
  ]);
  assert.equal(result.program.contract, MIXED_CONTRACT);
  assert.equal(result.program.compatibilityIdentity, PROGRAM_IDENTITY);
  assert.equal(result.program.nodes.length, 2216);
  assert.equal(result.program.nodes.filter(({ materialization }) => materialization === 'materialize').length, 1340);
  assert.deepEqual(countBy(result.program.nodes, ({ op }) => op), [
    ['binary', 729],
    ['concat', 10],
    ['contiguous', 4],
    ['gather', 3],
    ['matmul', 273],
    ['permute', 1],
    ['reduce', 197],
    ['reshape', 379],
    ['slice', 496],
    ['unary', 124],
  ]);
  assert.deepEqual(countBy(result.program.nodes.filter(({ op }) => op === 'unary'), ({ options }) => options.operator), [
    ['erf', 25],
    ['exp', 64],
    ['sqrt', 34],
    ['tanh', 1],
  ]);
  assert.deepEqual(countBy(result.program.nodes.filter(({ op }) => op === 'reduce'), ({ options }) => options.operator), [
    ['maximum', 64],
    ['sum', 133],
  ]);
  assert.equal(result.plan.contract, 'SPEC-0004-static-tensor-plan-v1');
  assert.equal(result.plan.compatibilityIdentity, PLAN_IDENTITY);
  assert.equal(result.plan.allocations.length, 1340);
  assert.equal(result.plan.totalDistinctBytes, 24_457_004);
  assert.deepEqual(result.plan.unresolved, PLAN_UNRESOLVED);
  assert.deepEqual(result.program.inputs.map(({ name }) => name), ['features', 'parameters', 'constants']);
  assert.deepEqual(result.program.outputs.map(({ name, spec }) => ({ name, shape: [...spec.capacityShape], dtype: spec.dtype })), [
    { name: 'policy', shape: [1, 4162], dtype: 'f32' },
    { name: 'value', shape: [1, 1], dtype: 'f32' },
  ]);
  assert.equal(TensorProgram.create(JSON.parse(JSON.stringify(result.program.canonical))).compatibilityIdentity, result.program.compatibilityIdentity);
  assert.equal(result.program.nodes.some(({ op }) => op === 'fill'), false);
});

test('static distinct-resource accounting scales exactly with item capacity', () => {
  const one = buildLatticeKnightFp32TensorProgram({ itemCapacity: 1 });
  const two = buildLatticeKnightFp32TensorProgram({ itemCapacity: QUALIFICATION_ITEM_CAPACITY });

  assert.equal(two.program.contract, MIXED_CONTRACT);
  assert.equal(two.program.nodes.length, one.program.nodes.length);
  assert.deepEqual(two.program.outputs.map(({ name, spec }) => ({ name, shape: [...spec.capacityShape], dtype: spec.dtype })), [
    { name: 'policy', shape: [2, 4162], dtype: 'f32' },
    { name: 'value', shape: [2, 1], dtype: 'f32' },
  ]);
  assert.equal(two.plan.totalDistinctBytes, one.plan.totalDistinctBytes * QUALIFICATION_ITEM_CAPACITY);
  assert.equal(two.plan.allocations.length, one.plan.allocations.length);
  for (let index = 0; index < one.plan.allocations.length; index += 1) {
    assert.equal(two.plan.allocations[index].byteLength, one.plan.allocations[index].byteLength * QUALIFICATION_ITEM_CAPACITY);
  }
});

test('root-public Tensor callable compilation owns exact item ABI and workspace', { timeout: 60_000 }, async () => {
  assert.equal(CUDA_JS_TENSOR_COMPATIBILITY.package.version, '0.1.0-alpha.6');
  assert.equal(CUDA_JS_TENSOR_COMPATIBILITY.cudaJs.version, '0.1.0-alpha.18');
  assert.equal(CUDA_JS_TENSOR_COMPATIBILITY.cudaJs.protectedMainRevision, '45a9ef15537b52d6fd7c615b7e596676dfd00587');

  const result = buildLatticeKnightFp32TensorProgram({ itemCapacity: 1 });
  const runtime = await openCudaRuntimeForTesting({ compiler: true });
  try {
    const session = await TensorSession.open(runtime);
    try {
      const deviceProgram = await compileTensorDeviceProgram(session, result.plan, {
        itemCapacity: 1,
        itemInputs: ['features'],
      });

      assert.equal(deviceProgram.contract, DEVICE_CONTRACT);
      assert.equal(deviceProgram.compatibilityIdentity, DEVICE_PROGRAM_IDENTITY);
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
      assert.equal(deviceProgram.totalWorkspaceBytes, WORKSPACE_BYTES_PER_ITEM);
      assert.equal(deviceProgram.workspace.length, 1);
      assert.equal(deviceProgram.workspace[0].dtype, 'f32');
      assert.equal(deviceProgram.workspace[0].perItemElements, WORKSPACE_ELEMENTS_PER_ITEM);
      assert.equal(deviceProgram.workspace[0].byteLength, WORKSPACE_BYTES_PER_ITEM);
      assert.equal(deviceProgram.parameters.length, 7);
      assert.equal(deviceProgram.parameters.length, deviceProgram.function.parameters.length);
      assert.equal(deviceProgram.function.name, 'tensorRunItem');
      assert.equal(deviceProgram.function.returns, 'u32');
      assert.equal(deviceProgram.library.format, 'ptx');
      assert.equal(JSON.stringify(deviceProgram).includes('function tensorRunItem'), false);
      assert.equal(JSON.stringify(deviceProgram.canonical).includes('__device__'), false);
    } finally {
      const sessionReport = await session.close();
      assert.equal(sessionReport.graceful, true);
    }
  } finally {
    const runtimeReport = await runtime.close();
    assert.equal(runtimeReport.graceful, true);
  }
});

test('capacity-two qualification profile freezes bounded workspace while capacity three fails closed', { timeout: 90_000 }, async () => {
  assert.equal(QUALIFICATION_WORKSPACE_BYTES, WORKSPACE_BYTES_PER_ITEM * QUALIFICATION_ITEM_CAPACITY);
  assert(QUALIFICATION_WORKSPACE_BYTES < DEFAULT_DEVICE_WORKSPACE_LIMIT);
  assert(WORKSPACE_BYTES_PER_ITEM * 3 > DEFAULT_DEVICE_WORKSPACE_LIMIT);

  const two = buildLatticeKnightFp32TensorProgram({ itemCapacity: QUALIFICATION_ITEM_CAPACITY });
  const three = buildLatticeKnightFp32TensorProgram({ itemCapacity: 3 });
  const runtime = await openCudaRuntimeForTesting({ compiler: true });
  try {
    const session = await TensorSession.open(runtime);
    try {
      const deviceProgram = await compileTensorDeviceProgram(session, two.plan, {
        itemCapacity: QUALIFICATION_ITEM_CAPACITY,
        itemInputs: ['features'],
      });

      assert.equal(deviceProgram.contract, DEVICE_CONTRACT);
      assert.equal(deviceProgram.itemCapacity, QUALIFICATION_ITEM_CAPACITY);
      assert.equal(deviceProgram.canonical.profile.maxWorkspaceBytes, DEFAULT_DEVICE_WORKSPACE_LIMIT);
      assert.deepEqual(deviceProgram.itemInputs, ['features']);
      assert.deepEqual(deviceProgram.inputs.map(({ name, itemVarying }) => [name, itemVarying]), [
        ['features', true],
        ['parameters', false],
        ['constants', false],
      ]);
      assert.deepEqual(deviceProgram.outputs.map(({ name, perItemElements, elementCount, byteLength }) => [name, perItemElements, elementCount, byteLength]), [
        ['policy', 4162, 8324, 33_296],
        ['value', 1, 2, 8],
      ]);
      assert.equal(deviceProgram.totalWorkspaceBytes, QUALIFICATION_WORKSPACE_BYTES);
      assert.equal(deviceProgram.workspace.length, 1);
      assert.equal(deviceProgram.workspace[0].dtype, 'f32');
      assert.equal(deviceProgram.workspace[0].perItemElements, WORKSPACE_ELEMENTS_PER_ITEM);
      assert.equal(deviceProgram.workspace[0].elementCount, WORKSPACE_ELEMENTS_PER_ITEM * QUALIFICATION_ITEM_CAPACITY);
      assert.equal(deviceProgram.workspace[0].byteLength, QUALIFICATION_WORKSPACE_BYTES);
      assert.equal(deviceProgram.parameters.length, 7);
      assert.equal(deviceProgram.function.name, 'tensorRunItem');
      assert.equal(deviceProgram.function.returns, 'u32');
      assert.equal(deviceProgram.library.format, 'ptx');

      await assert.rejects(
        compileTensorDeviceProgram(session, three.plan, {
          itemCapacity: 3,
          itemInputs: ['features'],
        }),
        (error) => {
          assert.equal(error.code, 'TENSOR_DEVICE_WORKSPACE_LIMIT');
          assert.equal(error.category, 'pressure');
          assert.equal(error.details.required, WORKSPACE_BYTES_PER_ITEM * 3);
          assert.equal(error.details.maximum, DEFAULT_DEVICE_WORKSPACE_LIMIT);
          return true;
        },
      );
    } finally {
      const sessionReport = await session.close();
      assert.equal(sessionReport.graceful, true);
    }
  } finally {
    const runtimeReport = await runtime.close();
    assert.equal(runtimeReport.graceful, true);
  }
});
