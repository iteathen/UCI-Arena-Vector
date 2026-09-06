import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { CoverageError, verifyModelTensorCoverage } from './verify-model-tensor-coverage.mjs';

const legacyCapabilities = JSON.parse(fs.readFileSync(new URL('../contracts/cuda-js-tensor-program-capabilities-v1.json', import.meta.url), 'utf8'));
const currentCapabilities = JSON.parse(fs.readFileSync(new URL('../contracts/cuda-js-tensor-program-capabilities-v2.json', import.meta.url), 'utf8'));
const synthetic = JSON.parse(fs.readFileSync(new URL('../test/fixtures/model-tensor-coverage/supported-synthetic-v1.json', import.meta.url), 'utf8'));
const real = JSON.parse(fs.readFileSync(new URL('../test/fixtures/model-tensor-coverage/latticeknight-4m-real-v2.json', import.meta.url), 'utf8'));
const syntheticCopy = () => structuredClone(synthetic);
const realCopy = () => structuredClone(real);
const currentCopy = () => structuredClone(currentCapabilities);

function rejectsCode(fn, code) {
  assert.throws(fn, (error) => error instanceof CoverageError && error.code === code);
}
function captureError(fn, code) {
  let caught = null;
  try { fn(); } catch (error) { caught = error; }
  assert(caught instanceof CoverageError, 'expected CoverageError');
  assert.equal(caught.code, code);
  return caught;
}
function capabilitiesWithTanh() {
  const extended = currentCopy();
  extended.operations.unary = [...extended.operations.unary, 'tanh'];
  return extended;
}

test('legacy synthetic fixture preserves its pinned v1 capability snapshot behavior', () => {
  const result = verifyModelTensorCoverage(syntheticCopy(), legacyCapabilities);
  assert.equal(result.status, 'covered_synthetic_fixture');
  assert.equal(result.real_model_ready, false);
  assert.equal(result.tensor_provider_revision, '44376e151ab854c81d65df79db1717478ae8ce5b');
  assert.equal(result.tensor_program_contract, 'SPEC-0004-tensor-program-v1');
  assert.equal(result.minimum_input_bytes_per_item, 64);
  assert.equal(result.minimum_output_bytes_per_item, 36);
});

test('synthetic evidence cannot satisfy the first-real-model gate', () => {
  rejectsCode(() => verifyModelTensorCoverage(syntheticCopy(), legacyCapabilities, { requireReal: true }), 'VECTOR_MODEL_REAL_MODEL_REQUIRED');
});

test('frozen LatticeKnight model retains exact immutable source checkpoint and parameter provenance', () => {
  const result = verifyModelTensorCoverage(realCopy(), currentCapabilities);
  assert.equal(result.status, 'frozen_real_model_capability_gap');
  assert.equal(result.real_model_ready, false);
  assert.deepEqual(result.model_provenance, {
    repository: 'iteathen/the_restaurant',
    revision: '8c7d75672cee36aa2a39fbddf713041552770b22',
    packagePath: 'model_packages/compact_chessformer_gab_v1.json',
    packageBlob: '326ba7dd0584438a911baf5051e5f1bedd831274',
    specPath: 'specs/compact_chessformer_gab_v1.yaml',
  });
  assert.equal(result.checkpoint.runId, 'run_1784364601_12348');
  assert.equal(result.checkpoint.batch, 54499);
  assert.equal(result.checkpoint.sha256, '62dec13c22a4414db6b78ea9b6ca76bcf6f29a16a963c01d13d947d158b09c7e');
  assert.equal(result.checkpoint.tensorCount, 227);
  assert.equal(result.checkpoint.parameterCount, 3637988);
  assert.equal(result.checkpoint.parameterDtype, 'f32');
  assert.equal(result.checkpoint.parameterBytes, 14551952);
  assert.equal(result.minimum_input_bytes_per_item, 4352);
  assert.equal(result.minimum_output_bytes_per_item, 16652);
  assert.equal(result.declared_resources.workspaceBytesPerItem, null);
});

test('current protected Tensor closes erf/gather/concat and exposes only value tanh as the model semantic capability gap', () => {
  const result = verifyModelTensorCoverage(realCopy(), currentCapabilities);
  assert.equal(result.tensor_provider_revision, '62cc5f1076766219fc6e3561eee86cdd66803813');
  assert.equal(result.tensor_program_contract, 'SPEC-0004-tensor-program-v1+SPEC-0010-erf-gather-concat-v1');
  assert.equal(result.required_tensor_program_contract, result.tensor_program_contract);
  assert.deepEqual(result.missing_capabilities, [
    { id: 'value-tanh', kind: 'unary', operator: 'tanh', reason: 'operator_unavailable' },
  ]);
});

test('real-model readiness fails closed on the corrected tanh gap rather than stale erf/gather/concat gaps', () => {
  const error = captureError(() => verifyModelTensorCoverage(realCopy(), currentCapabilities, { requireReal: true }), 'VECTOR_MODEL_TENSOR_CAPABILITY_GAP');
  assert.deepEqual(error.detail.missing_capabilities.map(({ kind, operator }) => [kind, operator]), [['unary', 'tanh']]);
});

test('supplying tanh exposes unresolved TensorPlan workspace as the next gate', () => {
  const extended = capabilitiesWithTanh();
  const result = verifyModelTensorCoverage(realCopy(), extended);
  assert.equal(result.status, 'frozen_real_model_workspace_unresolved');
  assert.equal(result.real_model_ready, false);
  assert.deepEqual(result.missing_capabilities, []);
  assert.equal(result.required_tensor_program_contract, 'SPEC-0004-tensor-program-v1+SPEC-0010-erf-gather-concat-v1');
  rejectsCode(() => verifyModelTensorCoverage(realCopy(), extended, { requireReal: true }), 'VECTOR_MODEL_WORKSPACE_UNRESOLVED');
});

test('extension operations require the exact additive SPEC-0010 TensorProgram contract', () => {
  const manifest = realCopy();
  manifest.tensor_contract.tensor_program_contract = 'SPEC-0004-tensor-program-v1';
  rejectsCode(() => verifyModelTensorCoverage(manifest, currentCapabilities), 'VECTOR_MODEL_TENSOR_CONTRACT_MISMATCH');
});

test('checkpoint byte count must agree with parameter count and dtype', () => {
  const manifest = realCopy();
  manifest.model.checkpoint.parameter_bytes -= 4;
  rejectsCode(() => verifyModelTensorCoverage(manifest, currentCapabilities), 'VECTOR_MODEL_PARAMETER_LAYOUT_INVALID');
});

test('declared resource parameter bytes must agree with frozen checkpoint', () => {
  const manifest = realCopy();
  manifest.resources.parameter_bytes -= 4;
  rejectsCode(() => verifyModelTensorCoverage(manifest, currentCapabilities), 'VECTOR_MODEL_RESOURCE_MISMATCH');
});

test('an uncovered v1 mathematical operation preserves fail-first legacy behavior', () => {
  const manifest = syntheticCopy();
  manifest.operations.push({ id: 'attention-softmax', kind: 'softmax' });
  rejectsCode(() => verifyModelTensorCoverage(manifest, legacyCapabilities), 'VECTOR_MODEL_OPERATION_UNSUPPORTED');
});

test('an unsupported v1 operator preserves fail-first legacy behavior', () => {
  const manifest = syntheticCopy();
  manifest.operations[2] = { id: 'activation', kind: 'unary', operator: 'tanh' };
  rejectsCode(() => verifyModelTensorCoverage(manifest, legacyCapabilities), 'VECTOR_MODEL_OPERATOR_UNSUPPORTED');
});

test('undersized finite resource accounting fails closed', () => {
  const manifest = syntheticCopy();
  manifest.resources.output_bytes_per_item = 35;
  rejectsCode(() => verifyModelTensorCoverage(manifest, legacyCapabilities), 'VECTOR_MODEL_RESOURCE_UNDERSIZED');
});

test('unknown fields cannot smuggle a private or native implementation path', () => {
  const manifest = realCopy();
  manifest.model.source.runtime_path = '../native/build/model.dll';
  rejectsCode(() => verifyModelTensorCoverage(manifest, currentCapabilities), 'VECTOR_MODEL_SOURCE_IDENTITY_INVALID');
});

test('Tensor package/revision drift fails closed for real evidence', () => {
  const manifest = realCopy();
  manifest.tensor_contract.provider_revision = '0000000000000000000000000000000000000000';
  rejectsCode(() => verifyModelTensorCoverage(manifest, currentCapabilities), 'VECTOR_MODEL_TENSOR_CONTRACT_MISMATCH');
});

test('capability snapshot cannot silently map an extension operation to an unknown Tensor contract key', () => {
  const capabilities = currentCopy();
  capabilities.extension_operation_contracts.gather = 'unknown';
  rejectsCode(() => verifyModelTensorCoverage(realCopy(), capabilities), 'VECTOR_TENSOR_CAPABILITY_INVALID');
});
