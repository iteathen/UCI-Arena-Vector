import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import {
  OracleError,
  compareModelNumericalOracle,
  normalizeOracleReceipt,
} from './verify-model-numerical-oracle.mjs';

const CHECKPOINT = '62dec13c22a4414db6b78ea9b6ca76bcf6f29a16a963c01d13d947d158b09c7e';

function count(shape) { return shape.reduce((product, extent) => product * extent, 1); }
function encoded(shape, valueAt) {
  const bytes = Buffer.alloc(count(shape) * 4);
  for (let index = 0; index < count(shape); index += 1) bytes.writeFloatLE(valueAt(index), index * 4);
  return {
    dtype: 'f32',
    shape: [...shape],
    encoding: 'base64-le-f32',
    sha256: createHash('sha256').update(bytes).digest('hex'),
    bytes_base64: bytes.toString('base64'),
  };
}
function mutated(raw, index, delta) {
  const bytes = Buffer.from(raw.bytes_base64, 'base64');
  bytes.writeFloatLE(bytes.readFloatLE(index * 4) + delta, index * 4);
  return {
    ...raw,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    bytes_base64: bytes.toString('base64'),
  };
}
function model() {
  return {
    id: 'compact_chessformer_gab_v1',
    producer: {
      repository: 'iteathen/the_restaurant',
      revision: '8c7d75672cee36aa2a39fbddf713041552770b22',
    },
    checkpoint: {
      run_id: 'run_1784364601_12348',
      batch: 54499,
      sha256: CHECKPOINT,
    },
    precision: 'f32',
  };
}
function fixtures() {
  const a = {
    id: 'position-a',
    input: encoded([1, 17, 8, 8], (index) => ((index % 17) - 8) / 16),
    outputs: {
      policy: encoded([1, 4162], (index) => ((index % 97) - 48) / 32),
      value: encoded([1, 1], () => 0.25),
    },
  };
  const b = {
    id: 'position-b',
    input: encoded([1, 17, 8, 8], (index) => ((index % 11) - 5) / 8),
    outputs: {
      policy: encoded([1, 4162], (index) => ((index % 53) - 26) / 16),
      value: encoded([1, 1], () => -0.5),
    },
  };
  const oracle = {
    contract: 'vector-checkpoint-numerical-oracle-v1',
    source_class: 'independent_checkpoint_oracle',
    model: model(),
    oracle: {
      owner_repository: 'iteathen/the_restaurant',
      owner_revision: '8c7d75672cee36aa2a39fbddf713041552770b22',
      execution_contract: 'native_onnx_numeric_parity',
      runtime: { name: 'onnxruntime', version: 'test-1.0', provider: 'CPUExecutionProvider' },
      artifact: { kind: 'onnx', sha256: 'a'.repeat(64) },
      independence: { vector_mapper_used: false, cuda_js_tensor_used: false },
    },
    criterion: {
      policy: { absolute_tolerance: 1e-5, relative_tolerance: 1e-5 },
      value: { absolute_tolerance: 1e-5, relative_tolerance: 1e-5 },
      basis: 'vector-product-criterion-test-v1',
    },
    items: [a, b],
    required_occupancies: ['full-capacity-2', 'partial-1-of-2'],
  };
  const observedItem = (item, itemIndex) => ({
    item_id: item.id,
    item_index: itemIndex,
    input_sha256: item.input.sha256,
    outputs: structuredClone(item.outputs),
  });
  const cleanup = { tensor_session_graceful: true, cuda_runtime_graceful: true };
  const observation = {
    contract: 'vector-checkpoint-numerical-observation-v1',
    source_class: 'public_tensor_observation',
    model: model(),
    tensor: {
      package: 'cuda-js-tensor',
      version: '0.1.0-alpha.6',
      revision: '0da2c70a0a10df908a33e842aa4ba3dbd7605c48',
      cuda_js_revision: '45a9ef15537b52d6fd7c615b7e596676dfd00587',
      program_identity: 'tensor-program-v1:3ef2b2fafdc3bbfa8b676668198b6f1bc91f0657adb3d04bf8e0a3c2d3644358',
      plan_identity: 'tensor-plan-v1:ae83f14f81e5417aed2695f1153266470370d6aecb6c3f6114ab50c201a13dba',
      device_program_identity: 'tensor-device-program-v1:70d86fd70c97d8b585eb89a9a1cace19572f1d1fe27df11e155f9ce355eed2fb',
      item_capacity: 2,
      execution_path: 'public-cuda-js-tensor-device-callable',
    },
    scenarios: [
      {
        id: 'full-capacity-2',
        active_items: 2,
        items: [observedItem(a, 0), observedItem(b, 1)],
        cleanup: structuredClone(cleanup),
      },
      {
        id: 'partial-1-of-2',
        active_items: 1,
        items: [observedItem(a, 0)],
        cleanup: structuredClone(cleanup),
      },
    ],
  };
  return { oracle, observation };
}

function expectsCode(code) {
  return (error) => {
    assert(error instanceof OracleError);
    assert.equal(error.code, code);
    return true;
  };
}

test('exact frozen checkpoint oracle receipt and full/partial public Tensor observations match', () => {
  const { oracle, observation } = fixtures();
  const result = compareModelNumericalOracle(oracle, observation);
  assert.equal(result.status, 'matched_independent_checkpoint_oracle');
  assert.equal(result.checkpoint_sha256, CHECKPOINT);
  assert.equal(result.item_capacity, 2);
  assert.deepEqual(result.occupancies, ['full-capacity-2', 'partial-1-of-2']);
  assert.equal(result.comparisons.length, 3);
  assert.equal(result.cleanup, 'graceful');
  for (const comparison of result.comparisons) {
    assert.equal(comparison.policy.maxAbsoluteError, 0);
    assert.equal(comparison.value.maxAbsoluteError, 0);
  }
});

test('oracle expected outputs cannot be self-derived from Vector or CUDA-JS-Tensor', () => {
  const { oracle } = fixtures();
  oracle.oracle.owner_repository = 'iteathen/UCI-Arena-Vector';
  assert.throws(() => normalizeOracleReceipt(oracle), expectsCode('VECTOR_MODEL_ORACLE_INDEPENDENCE_INVALID'));

  const second = fixtures().oracle;
  second.oracle.independence.cuda_js_tensor_used = true;
  assert.throws(() => normalizeOracleReceipt(second), expectsCode('VECTOR_MODEL_ORACLE_INDEPENDENCE_INVALID'));
});

test('wrong checkpoint identity fails before numerical comparison', () => {
  const { oracle, observation } = fixtures();
  oracle.model.checkpoint.sha256 = 'b'.repeat(64);
  assert.throws(() => compareModelNumericalOracle(oracle, observation), expectsCode('VECTOR_MODEL_ORACLE_IDENTITY'));
});

test('one changed observed policy value trips the numerical oracle', () => {
  const { oracle, observation } = fixtures();
  observation.scenarios[0].items[1].outputs.policy = mutated(observation.scenarios[0].items[1].outputs.policy, 211, 0.125);
  assert.throws(() => compareModelNumericalOracle(oracle, observation), expectsCode('VECTOR_MODEL_ORACLE_MISMATCH'));
});

test('observation must bind the exact input bytes used by the independent oracle', () => {
  const { oracle, observation } = fixtures();
  observation.scenarios[0].items[0].input_sha256 = 'c'.repeat(64);
  assert.throws(() => compareModelNumericalOracle(oracle, observation), expectsCode('VECTOR_MODEL_ORACLE_INPUT_MISMATCH'));
});

test('full and partial occupancy are both required and partial repeats full slot zero', () => {
  const missing = fixtures();
  missing.observation.scenarios[1].id = 'other';
  assert.throws(() => compareModelNumericalOracle(missing.oracle, missing.observation), expectsCode('VECTOR_MODEL_ORACLE_OCCUPANCY_INVALID'));

  const coupled = fixtures();
  coupled.observation.scenarios[1].items[0] = {
    ...coupled.observation.scenarios[0].items[1],
    item_index: 0,
  };
  assert.throws(() => compareModelNumericalOracle(coupled.oracle, coupled.observation), expectsCode('VECTOR_MODEL_ORACLE_OCCUPANCY_INVALID'));
});

test('cleanup is part of the numerical qualification receipt', () => {
  const { oracle, observation } = fixtures();
  observation.scenarios[1].cleanup.tensor_session_graceful = false;
  assert.throws(() => compareModelNumericalOracle(oracle, observation), expectsCode('VECTOR_MODEL_ORACLE_CLEANUP_INVALID'));
});
