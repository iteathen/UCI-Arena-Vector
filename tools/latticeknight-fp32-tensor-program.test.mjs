import assert from 'node:assert/strict';
import test from 'node:test';

import {
  LATTICEKNIGHT_FP32_PROGRAM_PROFILE,
  buildLatticeKnightFp32TensorProgram,
} from './latticeknight-fp32-tensor-program.mjs';

test('frozen LatticeKnight FP32 candidate constructs one exact public TensorProgram/TensorPlan', () => {
  const result = buildLatticeKnightFp32TensorProgram({ itemCapacity: 1 });

  assert.equal(result.profile, LATTICEKNIGHT_FP32_PROGRAM_PROFILE);
  assert.equal(result.itemCapacity, 1);
  assert.equal(result.parameterLayout.tensorCount, 227);
  assert.equal(result.parameterLayout.elementCount, 3_637_988);
  assert.equal(result.parameterLayout.byteLength, 14_551_952);
  assert.equal(result.program.contract, 'SPEC-0004-tensor-program-v1+SPEC-0010-erf-gather-concat-v1+SPEC-0011-tanh-v1');
  assert.equal(result.plan.contract, 'SPEC-0004-static-tensor-plan-v1');
  assert.deepEqual(result.program.inputs.map(({ name }) => name), ['features', 'parameters', 'constants']);
  assert.deepEqual(result.program.outputs.map(({ name, spec }) => ({ name, shape: [...spec.capacityShape], dtype: spec.dtype })), [
    { name: 'policy', shape: [1, 4162], dtype: 'f32' },
    { name: 'value', shape: [1, 1], dtype: 'f32' },
  ]);
  assert(result.program.nodes.length > 0 && result.program.nodes.length <= 4096);
  assert(Number.isSafeInteger(result.plan.totalDistinctBytes) && result.plan.totalDistinctBytes > 0);
});
