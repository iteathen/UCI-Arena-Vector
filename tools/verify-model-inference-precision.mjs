import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CoverageError, verifyModelTensorCoverage } from './verify-model-tensor-coverage.mjs';

const MANIFEST_V2 = 'vector-model-tensor-coverage-v2';
const MANIFEST_V3 = 'vector-model-tensor-coverage-v3';
const RESULT_V3 = 'vector-model-tensor-coverage-result-v3';
const PRECISION_FIELDS = new Set([
  'selection_role',
  'candidate',
  'compute_dtype',
  'public_io_dtype',
  'producer_supported_candidates',
  'producer_parity_status',
  'producer_provider_status',
  'producer_promotion_ready',
  'producer_default_activation_ready',
  'training_precision_authority',
]);
const TOP_V3_FIELDS = new Set([
  'contract',
  'source_class',
  'coverage_scope',
  'model',
  'inference_precision',
  'tensor_contract',
  'inputs',
  'operations',
  'outputs',
  'resources',
]);
const SELECTION_ROLES = new Set(['qualification_candidate', 'producer_promoted', 'producer_default']);
const CANDIDATE_COMPUTE_DTYPE = Object.freeze({ fp32: 'f32', fp16_weights: 'f16' });
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function fail(code, message, detail) { throw new CoverageError(code, message, detail); }
function plain(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function exact(value, fields, code, label) {
  if (!plain(value)) fail(code, `${label} must be an object.`);
  for (const key of Object.keys(value)) if (!fields.has(key)) fail(code, `${label} contains unknown field '${key}'.`);
}
function identifier(value, field) {
  if (typeof value !== 'string' || !IDENTIFIER.test(value)) fail('VECTOR_MODEL_PRECISION_INVALID', `${field} must be a bounded identifier.`);
  return value;
}
function boolean(value, field) {
  if (typeof value !== 'boolean') fail('VECTOR_MODEL_PRECISION_INVALID', `${field} must be boolean.`);
  return value;
}

export function normalizeInferencePrecision(raw, manifest) {
  exact(raw, PRECISION_FIELDS, 'VECTOR_MODEL_PRECISION_INVALID', 'inference_precision');
  if (!SELECTION_ROLES.has(raw.selection_role)) fail('VECTOR_MODEL_PRECISION_INVALID', 'inference_precision.selection_role is not recognized.');
  if (!Object.hasOwn(CANDIDATE_COMPUTE_DTYPE, raw.candidate)) fail('VECTOR_MODEL_PRECISION_INVALID', 'inference_precision.candidate is not a producer-supported precision candidate.');
  if (raw.compute_dtype !== CANDIDATE_COMPUTE_DTYPE[raw.candidate]) fail('VECTOR_MODEL_PRECISION_INVALID', 'inference_precision.compute_dtype does not match the selected producer candidate.');
  if (raw.public_io_dtype !== 'f32') fail('VECTOR_MODEL_PRECISION_INVALID', 'The frozen LatticeKnight public inference I/O contract is f32.');
  if (!Array.isArray(raw.producer_supported_candidates) || raw.producer_supported_candidates.length !== 2 || raw.producer_supported_candidates[0] !== 'fp32' || raw.producer_supported_candidates[1] !== 'fp16_weights') {
    fail('VECTOR_MODEL_PRECISION_INVALID', 'Frozen producer precision candidates must be canonical [fp32, fp16_weights].');
  }
  identifier(raw.producer_parity_status, 'inference_precision.producer_parity_status');
  identifier(raw.producer_provider_status, 'inference_precision.producer_provider_status');
  const promotionReady = boolean(raw.producer_promotion_ready, 'inference_precision.producer_promotion_ready');
  const defaultReady = boolean(raw.producer_default_activation_ready, 'inference_precision.producer_default_activation_ready');
  if (raw.training_precision_authority !== 'not_inference_selection') fail('VECTOR_MODEL_PRECISION_INVALID', 'Training AMP precision must not be reused as inference-selection authority.');
  if (defaultReady && !promotionReady) fail('VECTOR_MODEL_PRECISION_INVALID', 'Producer default activation cannot be ready before promotion.');
  if (promotionReady && (raw.producer_parity_status !== 'pass' || raw.producer_provider_status !== 'pass')) fail('VECTOR_MODEL_PRECISION_INVALID', 'Producer promotion requires passing parity and provider reports.');
  if (raw.selection_role === 'producer_promoted' && !promotionReady) fail('VECTOR_MODEL_PRECISION_INVALID', 'producer_promoted requires producer_promotion_ready=true.');
  if (raw.selection_role === 'producer_default' && !defaultReady) fail('VECTOR_MODEL_PRECISION_INVALID', 'producer_default requires producer_default_activation_ready=true.');

  for (const [index, entry] of manifest.inputs.entries()) {
    if (entry.dtype !== raw.public_io_dtype) fail('VECTOR_MODEL_PRECISION_INVALID', `inputs[${index}].dtype must match public_io_dtype.`);
  }
  for (const [index, entry] of manifest.outputs.entries()) {
    if (entry.dtype !== raw.public_io_dtype) fail('VECTOR_MODEL_PRECISION_INVALID', `outputs[${index}].dtype must match public_io_dtype.`);
  }

  return Object.freeze({
    selectionRole: raw.selection_role,
    candidate: raw.candidate,
    computeDtype: raw.compute_dtype,
    publicIoDtype: raw.public_io_dtype,
    producerSupportedCandidates: Object.freeze([...raw.producer_supported_candidates]),
    producerParityStatus: raw.producer_parity_status,
    producerProviderStatus: raw.producer_provider_status,
    producerPromotionReady: promotionReady,
    producerDefaultActivationReady: defaultReady,
    trainingPrecisionAuthority: raw.training_precision_authority,
  });
}

export function verifyModelInferencePrecisionCoverage(manifest, capabilityRecord, options = {}) {
  if (!plain(manifest)) fail('VECTOR_MODEL_MANIFEST_INVALID', 'manifest must be an object.');
  if (manifest.contract !== MANIFEST_V3) fail('VECTOR_MODEL_MANIFEST_CONTRACT_INVALID', `Expected ${MANIFEST_V3}.`);
  exact(manifest, TOP_V3_FIELDS, 'VECTOR_MODEL_MANIFEST_INVALID', 'manifest');
  if (manifest.source_class !== 'frozen_real_model') fail('VECTOR_MODEL_SOURCE_CLASS_INVALID', 'v3 precision evidence is reserved for a frozen real model.');
  if (manifest.coverage_scope !== 'model_semantic_capability_matrix_v1') fail('VECTOR_MODEL_COVERAGE_SCOPE_INVALID', 'v3 coverage_scope must remain model_semantic_capability_matrix_v1.');

  const precision = normalizeInferencePrecision(manifest.inference_precision, manifest);
  const delegated = structuredClone(manifest);
  delegated.contract = MANIFEST_V2;
  delete delegated.inference_precision;
  const coverage = verifyModelTensorCoverage(delegated, capabilityRecord, options);

  return Object.freeze({
    ...coverage,
    contract: RESULT_V3,
    manifest_contract: MANIFEST_V3,
    inference_precision: precision,
  });
}

function parseArgs(argv) {
  const args = { requireReal: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--require-real') args.requireReal = true;
    else if (token === '--manifest' || token === '--capabilities') {
      const value = argv[++index];
      if (!value) fail('VECTOR_MODEL_CLI_INVALID', `${token} requires a path.`);
      args[token.slice(2)] = value;
    } else fail('VECTOR_MODEL_CLI_INVALID', `Unknown argument '${token}'.`);
  }
  if (!args.manifest || !args.capabilities) fail('VECTOR_MODEL_CLI_INVALID', 'Usage: node tools/verify-model-inference-precision.mjs --manifest <path> --capabilities <path> [--require-real]');
  return args;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const manifest = JSON.parse(fs.readFileSync(args.manifest, 'utf8'));
    const capabilities = JSON.parse(fs.readFileSync(args.capabilities, 'utf8'));
    const result = verifyModelInferencePrecisionCoverage(manifest, capabilities, { requireReal: args.requireReal });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    if (error instanceof CoverageError) {
      process.stderr.write(`${JSON.stringify({ contract: RESULT_V3, status: 'failed', code: error.code, message: error.message, detail: error.detail ?? null })}\n`);
      process.exitCode = 1;
    } else throw error;
  }
}
