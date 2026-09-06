import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { verifyModelTensorCoverage } from './verify-model-tensor-coverage.mjs';

const capabilities = JSON.parse(fs.readFileSync(new URL('../contracts/cuda-js-tensor-program-capabilities-v3.json', import.meta.url), 'utf8'));
const frozen = JSON.parse(fs.readFileSync(new URL('../test/fixtures/model-tensor-coverage/latticeknight-4m-real-v2.json', import.meta.url), 'utf8'));

const precisionProfile = Object.freeze({
  selection_role: 'qualification_candidate',
  candidate: 'fp32',
  compute_dtype: 'f32',
  public_io_dtype: 'f32',
  producer_supported_candidates: ['fp32', 'fp16_weights'],
  producer_parity_status: 'pending_native_onnx_runtime_measurement',
  producer_provider_status: 'pending_directml_host_measurement',
  producer_promotion_ready: false,
  producer_default_activation_ready: false,
  alternate_fp16_compute_candidate: true,
});

test('frozen LatticeKnight binds fp32 only as a qualification candidate, not producer-promoted/default precision', () => {
  const manifest = structuredClone(frozen);
  manifest.contract = 'vector-model-tensor-coverage-v3';
  manifest.inference_precision = structuredClone(precisionProfile);

  const result = verifyModelTensorCoverage(manifest, capabilities);
  assert.deepEqual(result.inference_precision, precisionProfile);
  assert.equal(result.status, 'frozen_real_model_workspace_unresolved');
  assert.equal(result.real_model_ready, false);
  assert.deepEqual(result.missing_capabilities, []);
});
