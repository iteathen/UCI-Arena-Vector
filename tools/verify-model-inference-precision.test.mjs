import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { CoverageError } from './verify-model-tensor-coverage.mjs';
import { verifyModelInferencePrecisionCoverage } from './verify-model-inference-precision.mjs';

const capabilities = JSON.parse(fs.readFileSync(new URL('../contracts/cuda-js-tensor-program-capabilities-v3.json', import.meta.url), 'utf8'));
const frozen = JSON.parse(fs.readFileSync(new URL('../test/fixtures/model-tensor-coverage/latticeknight-4m-real-v3.json', import.meta.url), 'utf8'));
const frozenCopy = () => structuredClone(frozen);

function rejectsPrecision(mutator) {
  const manifest = frozenCopy();
  mutator(manifest);
  assert.throws(
    () => verifyModelInferencePrecisionCoverage(manifest, capabilities),
    (error) => error instanceof CoverageError && error.code === 'VECTOR_MODEL_PRECISION_INVALID',
  );
}

test('frozen LatticeKnight binds fp32 only as a qualification candidate, not producer-promoted/default precision', () => {
  const result = verifyModelInferencePrecisionCoverage(frozenCopy(), capabilities);
  assert.deepEqual(result.inference_precision, {
    profile: 'latticeknight-4m-inference-precision-v1',
    selectionRole: 'qualification_candidate',
    candidate: 'fp32',
    computeDtype: 'f32',
    publicIoDtype: 'f32',
    producerSupportedCandidates: ['fp32', 'fp16_weights'],
    producerParityStatus: 'pending_native_onnx_runtime_measurement',
    producerProviderStatus: 'pending_directml_host_measurement',
    producerPromotionReady: false,
    producerDefaultActivationReady: false,
    trainingPrecisionAuthority: 'not_inference_selection',
  });
  assert.equal(result.contract, 'vector-model-tensor-coverage-result-v3');
  assert.equal(result.manifest_contract, 'vector-model-tensor-coverage-v3');
  assert.equal(result.status, 'covered_real_model');
  assert.equal(result.real_model_ready, true);
  assert.equal(result.tensor_provider_revision, '0da2c70a0a10df908a33e842aa4ba3dbd7605c48');
  assert.equal(result.declared_resources.workspaceBytesPerItem, 33_194_524);
  assert.deepEqual(result.missing_capabilities, []);
});

test('precision profile is bound to the exact frozen LatticeKnight producer identity', () => {
  rejectsPrecision((manifest) => { manifest.inference_precision.profile = 'generic-model-precision-v1'; });
  rejectsPrecision((manifest) => { manifest.model.source.revision = '0000000000000000000000000000000000000000'; });
});

test('pending producer reports cannot be relabeled as promoted or default precision', () => {
  rejectsPrecision((manifest) => { manifest.inference_precision.selection_role = 'producer_promoted'; });
  rejectsPrecision((manifest) => { manifest.inference_precision.selection_role = 'producer_default'; });
});

test('fp16_weights is an fp16 compute candidate, not a storage-only alias for f32 compute', () => {
  rejectsPrecision((manifest) => {
    manifest.inference_precision.candidate = 'fp16_weights';
    manifest.inference_precision.compute_dtype = 'f32';
  });
});

test('training AMP precision cannot become inference-selection authority', () => {
  rejectsPrecision((manifest) => { manifest.inference_precision.training_precision_authority = 'fp16_autocast'; });
});
