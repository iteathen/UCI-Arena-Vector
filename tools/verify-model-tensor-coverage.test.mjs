import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { CoverageError, verifyModelTensorCoverage } from './verify-model-tensor-coverage.mjs';

const capabilities = JSON.parse(fs.readFileSync(new URL('../contracts/cuda-js-tensor-program-capabilities-v1.json', import.meta.url), 'utf8'));
const fixture = JSON.parse(fs.readFileSync(new URL('../test/fixtures/model-tensor-coverage/supported-synthetic-v1.json', import.meta.url), 'utf8'));
const copy = () => structuredClone(fixture);

function rejectsCode(fn, code) {
  assert.throws(fn, (error) => error instanceof CoverageError && error.code === code);
}

test('supported synthetic model covers the pinned public Tensor contract', () => {
  const result = verifyModelTensorCoverage(copy(), capabilities);
  assert.equal(result.status, 'covered_synthetic_fixture');
  assert.equal(result.real_model_ready, false);
  assert.equal(result.minimum_input_bytes_per_item, 64);
  assert.equal(result.minimum_output_bytes_per_item, 36);
});

test('synthetic evidence cannot satisfy the first-real-model gate', () => {
  rejectsCode(() => verifyModelTensorCoverage(copy(), capabilities, { requireReal: true }), 'VECTOR_MODEL_REAL_MODEL_REQUIRED');
});

test('an uncovered mathematical operation fails closed', () => {
  const manifest = copy();
  manifest.operations.push({ id: 'attention-softmax', kind: 'softmax' });
  rejectsCode(() => verifyModelTensorCoverage(manifest, capabilities), 'VECTOR_MODEL_OPERATION_UNSUPPORTED');
});

test('an unsupported operator fails closed', () => {
  const manifest = copy();
  manifest.operations[2] = { id: 'activation', kind: 'unary', operator: 'tanh' };
  rejectsCode(() => verifyModelTensorCoverage(manifest, capabilities), 'VECTOR_MODEL_OPERATOR_UNSUPPORTED');
});

test('undersized finite resource accounting fails closed', () => {
  const manifest = copy();
  manifest.resources.output_bytes_per_item = 35;
  rejectsCode(() => verifyModelTensorCoverage(manifest, capabilities), 'VECTOR_MODEL_RESOURCE_UNDERSIZED');
});

test('unknown fields cannot smuggle a private or native implementation path', () => {
  const manifest = copy();
  manifest.operations[0].native_backend = 'consumer-local';
  rejectsCode(() => verifyModelTensorCoverage(manifest, capabilities), 'VECTOR_MODEL_OPERATION_INVALID');
});

test('Tensor package/revision drift fails closed', () => {
  const manifest = copy();
  manifest.tensor_contract.provider_revision = '0000000000000000000000000000000000000000';
  rejectsCode(() => verifyModelTensorCoverage(manifest, capabilities), 'VECTOR_MODEL_TENSOR_CONTRACT_MISMATCH');
});
