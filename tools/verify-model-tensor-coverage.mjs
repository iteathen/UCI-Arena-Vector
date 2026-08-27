import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MANIFEST_CONTRACT = 'vector-model-tensor-coverage-v1';
const SOURCE_CLASSES = new Set(['synthetic_contract_fixture', 'frozen_real_model']);
const DTYPE_BYTES = Object.freeze({ u32: 4, u64: 8, i32: 4, f16: 2, bf16: 2, f32: 4, f64: 8 });
const HEX64 = /^[0-9a-f]{64}$/;
const NAME = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const MAX_SAFE = Number.MAX_SAFE_INTEGER;
const TOP_FIELDS = new Set(['contract', 'source_class', 'model', 'tensor_contract', 'inputs', 'operations', 'outputs', 'resources']);
const MODEL_FIELDS = new Set(['id', 'package_digest', 'parameter_digest']);
const TENSOR_FIELDS = new Set(['provider_package', 'provider_version', 'provider_revision', 'tensor_program_contract']);
const VALUE_FIELDS = new Set(['name', 'dtype', 'shape']);
const OP_FIELDS = new Set(['id', 'kind', 'operator']);
const RESOURCE_FIELDS = new Set(['parameter_bytes', 'workspace_bytes_per_item', 'input_bytes_per_item', 'output_bytes_per_item']);

export class CoverageError extends Error {
  constructor(code, message, detail = undefined) {
    super(message);
    this.name = 'CoverageError';
    this.code = code;
    this.detail = detail;
  }
}

function fail(code, message, detail) { throw new CoverageError(code, message, detail); }
function plain(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function exact(value, fields, code, label) {
  if (!plain(value)) fail(code, `${label} must be an object.`);
  for (const key of Object.keys(value)) if (!fields.has(key)) fail(code, `${label} contains unknown field '${key}'.`);
}
function name(value, field) {
  if (typeof value !== 'string' || !NAME.test(value)) fail('VECTOR_MODEL_NAME_INVALID', `${field} is not a bounded identifier.`);
}
function digest(value, field) {
  if (typeof value !== 'string' || !HEX64.test(value)) fail('VECTOR_MODEL_DIGEST_INVALID', `${field} must be a lowercase SHA-256 hex digest.`);
}
function safeNonnegative(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) fail('VECTOR_MODEL_RESOURCE_INVALID', `${field} must be a nonnegative safe integer.`);
  return value;
}
function checkedMultiply(a, b, field) {
  const value = a * b;
  if (!Number.isSafeInteger(value) || value > MAX_SAFE) fail('VECTOR_MODEL_SIZE_OVERFLOW', `${field} exceeds safe-integer bounds.`);
  return value;
}
function tensorBytes(entry, limits, field) {
  exact(entry, VALUE_FIELDS, 'VECTOR_MODEL_TENSOR_INVALID', field);
  name(entry.name, `${field}.name`);
  if (!limits.dtypes.has(entry.dtype)) fail('VECTOR_MODEL_DTYPE_UNSUPPORTED', `${field}.dtype is not covered by the pinned Tensor contract.`, { dtype: entry.dtype });
  if (!Array.isArray(entry.shape) || entry.shape.length > limits.maxRank || entry.shape.some((dim) => !Number.isSafeInteger(dim) || dim < 0)) {
    fail('VECTOR_MODEL_SHAPE_INVALID', `${field}.shape must be rank 0-${limits.maxRank} with nonnegative safe-integer dimensions.`);
  }
  let elements = 1;
  for (const dim of entry.shape) elements = checkedMultiply(elements, dim, `${field}.elements`);
  return checkedMultiply(elements, DTYPE_BYTES[entry.dtype], `${field}.bytes`);
}

export function normalizeCapabilities(raw) {
  if (!plain(raw) || raw.contract !== 'vector-cuda-js-tensor-capabilities-v1') fail('VECTOR_TENSOR_CAPABILITY_CONTRACT_INVALID', 'Unknown Tensor capability snapshot contract.');
  if (raw.provider_package !== 'cuda-js-tensor') fail('VECTOR_TENSOR_PROVIDER_INVALID', 'Capability snapshot provider must be cuda-js-tensor.');
  if (typeof raw.provider_version !== 'string' || typeof raw.provider_revision !== 'string' || typeof raw.tensor_program_contract !== 'string') fail('VECTOR_TENSOR_CAPABILITY_IDENTITY_INVALID', 'Capability snapshot identity is incomplete.');
  if (!plain(raw.limits) || !plain(raw.operations) || !Array.isArray(raw.dtypes)) fail('VECTOR_TENSOR_CAPABILITY_INVALID', 'Capability snapshot is incomplete.');
  const maxInputs = safeNonnegative(raw.limits.max_inputs, 'limits.max_inputs');
  const maxNodes = safeNonnegative(raw.limits.max_nodes, 'limits.max_nodes');
  const maxOutputs = safeNonnegative(raw.limits.max_outputs, 'limits.max_outputs');
  const maxRank = safeNonnegative(raw.limits.max_rank, 'limits.max_rank');
  const dtypes = new Set(raw.dtypes);
  for (const dtype of dtypes) if (!Object.hasOwn(DTYPE_BYTES, dtype)) fail('VECTOR_TENSOR_CAPABILITY_INVALID', `Unknown dtype '${dtype}' in capability snapshot.`);
  const operations = new Map();
  for (const [kind, operators] of Object.entries(raw.operations)) {
    operations.set(kind, operators === null ? null : new Set(operators));
  }
  return Object.freeze({
    identity: Object.freeze({ providerPackage: raw.provider_package, providerVersion: raw.provider_version, providerRevision: raw.provider_revision, tensorProgramContract: raw.tensor_program_contract }),
    maxInputs, maxNodes, maxOutputs, maxRank, dtypes, operations,
  });
}

export function verifyModelTensorCoverage(manifest, capabilityRecord, { requireReal = false } = {}) {
  exact(manifest, TOP_FIELDS, 'VECTOR_MODEL_MANIFEST_INVALID', 'manifest');
  if (manifest.contract !== MANIFEST_CONTRACT) fail('VECTOR_MODEL_MANIFEST_CONTRACT_INVALID', `Expected ${MANIFEST_CONTRACT}.`);
  if (!SOURCE_CLASSES.has(manifest.source_class)) fail('VECTOR_MODEL_SOURCE_CLASS_INVALID', 'source_class is not recognized.');
  if (requireReal && manifest.source_class !== 'frozen_real_model') fail('VECTOR_MODEL_REAL_MODEL_REQUIRED', 'A synthetic fixture cannot satisfy first-real-model readiness.');

  exact(manifest.model, MODEL_FIELDS, 'VECTOR_MODEL_IDENTITY_INVALID', 'model');
  name(manifest.model.id, 'model.id');
  digest(manifest.model.package_digest, 'model.package_digest');
  digest(manifest.model.parameter_digest, 'model.parameter_digest');

  const capabilities = normalizeCapabilities(capabilityRecord);
  exact(manifest.tensor_contract, TENSOR_FIELDS, 'VECTOR_MODEL_TENSOR_CONTRACT_INVALID', 'tensor_contract');
  const expected = capabilities.identity;
  const actual = manifest.tensor_contract;
  if (actual.provider_package !== expected.providerPackage || actual.provider_version !== expected.providerVersion || actual.provider_revision !== expected.providerRevision || actual.tensor_program_contract !== expected.tensorProgramContract) {
    fail('VECTOR_MODEL_TENSOR_CONTRACT_MISMATCH', 'Model manifest is not bound to the pinned Tensor capability identity.', { expected, actual });
  }

  if (!Array.isArray(manifest.inputs) || manifest.inputs.length < 1 || manifest.inputs.length > capabilities.maxInputs) fail('VECTOR_MODEL_INPUT_LIMIT', 'Model inputs exceed the pinned TensorProgram bounds.');
  if (!Array.isArray(manifest.outputs) || manifest.outputs.length < 1 || manifest.outputs.length > capabilities.maxOutputs) fail('VECTOR_MODEL_OUTPUT_LIMIT', 'Model outputs exceed the pinned TensorProgram bounds.');
  if (!Array.isArray(manifest.operations) || manifest.operations.length > capabilities.maxNodes) fail('VECTOR_MODEL_OPERATION_LIMIT', 'Model operations exceed the pinned TensorProgram bounds.');

  const seenTensorNames = new Set();
  let inputBytes = 0;
  for (const [index, entry] of manifest.inputs.entries()) {
    inputBytes += tensorBytes(entry, capabilities, `inputs[${index}]`);
    if (seenTensorNames.has(entry.name)) fail('VECTOR_MODEL_NAME_DUPLICATE', `Duplicate tensor name '${entry.name}'.`);
    seenTensorNames.add(entry.name);
  }
  let outputBytes = 0;
  for (const [index, entry] of manifest.outputs.entries()) {
    outputBytes += tensorBytes(entry, capabilities, `outputs[${index}]`);
    if (seenTensorNames.has(entry.name)) fail('VECTOR_MODEL_NAME_DUPLICATE', `Duplicate tensor name '${entry.name}'.`);
    seenTensorNames.add(entry.name);
  }

  const seenOperations = new Set();
  const operationKinds = new Set();
  for (const [index, operation] of manifest.operations.entries()) {
    exact(operation, OP_FIELDS, 'VECTOR_MODEL_OPERATION_INVALID', `operations[${index}]`);
    name(operation.id, `operations[${index}].id`);
    if (seenOperations.has(operation.id)) fail('VECTOR_MODEL_OPERATION_DUPLICATE', `Duplicate operation id '${operation.id}'.`);
    seenOperations.add(operation.id);
    const accepted = capabilities.operations.get(operation.kind);
    if (accepted === undefined) fail('VECTOR_MODEL_OPERATION_UNSUPPORTED', `Operation kind '${operation.kind}' is not covered by the pinned public TensorProgram contract.`, { id: operation.id, kind: operation.kind });
    if (accepted === null) {
      if (operation.operator !== undefined) fail('VECTOR_MODEL_OPERATION_INVALID', `Operation '${operation.kind}' must not declare an operator.`);
    } else if (typeof operation.operator !== 'string' || !accepted.has(operation.operator)) {
      fail('VECTOR_MODEL_OPERATOR_UNSUPPORTED', `Operator '${operation.operator}' is not covered for '${operation.kind}'.`, { id: operation.id, kind: operation.kind, operator: operation.operator });
    }
    operationKinds.add(operation.kind);
  }

  exact(manifest.resources, RESOURCE_FIELDS, 'VECTOR_MODEL_RESOURCE_INVALID', 'resources');
  const resources = {
    parameterBytes: safeNonnegative(manifest.resources.parameter_bytes, 'resources.parameter_bytes'),
    workspaceBytesPerItem: safeNonnegative(manifest.resources.workspace_bytes_per_item, 'resources.workspace_bytes_per_item'),
    inputBytesPerItem: safeNonnegative(manifest.resources.input_bytes_per_item, 'resources.input_bytes_per_item'),
    outputBytesPerItem: safeNonnegative(manifest.resources.output_bytes_per_item, 'resources.output_bytes_per_item'),
  };
  if (resources.inputBytesPerItem < inputBytes) fail('VECTOR_MODEL_RESOURCE_UNDERSIZED', 'Declared input bytes are smaller than the tensor specification requires.', { required: inputBytes, declared: resources.inputBytesPerItem });
  if (resources.outputBytesPerItem < outputBytes) fail('VECTOR_MODEL_RESOURCE_UNDERSIZED', 'Declared output bytes are smaller than the tensor specification requires.', { required: outputBytes, declared: resources.outputBytesPerItem });

  return Object.freeze({
    contract: 'vector-model-tensor-coverage-result-v1',
    status: manifest.source_class === 'frozen_real_model' ? 'covered_real_model' : 'covered_synthetic_fixture',
    real_model_ready: manifest.source_class === 'frozen_real_model',
    model_id: manifest.model.id,
    model_package_digest: manifest.model.package_digest,
    tensor_provider_revision: expected.providerRevision,
    tensor_program_contract: expected.tensorProgramContract,
    input_count: manifest.inputs.length,
    operation_count: manifest.operations.length,
    output_count: manifest.outputs.length,
    operation_kinds: [...operationKinds].sort(),
    minimum_input_bytes_per_item: inputBytes,
    minimum_output_bytes_per_item: outputBytes,
    declared_resources: resources,
  });
}

function parseArgs(argv) {
  const args = { requireReal: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--require-real') args.requireReal = true;
    else if (token === '--manifest' || token === '--capabilities') {
      const value = argv[++i];
      if (!value) fail('VECTOR_MODEL_CLI_INVALID', `${token} requires a path.`);
      args[token.slice(2)] = value;
    } else fail('VECTOR_MODEL_CLI_INVALID', `Unknown argument '${token}'.`);
  }
  if (!args.manifest || !args.capabilities) fail('VECTOR_MODEL_CLI_INVALID', 'Usage: node tools/verify-model-tensor-coverage.mjs --manifest <path> --capabilities <path> [--require-real]');
  return args;
}

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const result = verifyModelTensorCoverage(readJson(args.manifest), readJson(args.capabilities), { requireReal: args.requireReal });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    const body = { contract: 'vector-model-tensor-coverage-result-v1', status: 'failed', code: error?.code ?? 'VECTOR_MODEL_COVERAGE_ERROR', message: error?.message ?? String(error) };
    process.stderr.write(`${JSON.stringify(body)}\n`);
    process.exitCode = 1;
  }
}
