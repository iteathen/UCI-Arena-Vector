import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MANIFEST_V1 = 'vector-model-tensor-coverage-v1';
const MANIFEST_V2 = 'vector-model-tensor-coverage-v2';
const CAPABILITIES_V1 = 'vector-cuda-js-tensor-capabilities-v1';
const CAPABILITIES_V2 = 'vector-cuda-js-tensor-capabilities-v2';
const CAPABILITIES_V3 = 'vector-cuda-js-tensor-capabilities-v3';
const SOURCE_CLASSES = new Set(['synthetic_contract_fixture', 'frozen_real_model']);
const DTYPE_BYTES = Object.freeze({ u32: 4, u64: 8, i32: 4, f16: 2, bf16: 2, f32: 4, f64: 8 });
const HEX40 = /^[0-9a-f]{40}$/;
const HEX64 = /^[0-9a-f]{64}$/;
const NAME = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const MAX_SAFE = Number.MAX_SAFE_INTEGER;
const TOP_FIELDS_V1 = new Set(['contract', 'source_class', 'model', 'tensor_contract', 'inputs', 'operations', 'outputs', 'resources']);
const TOP_FIELDS_V2 = new Set([...TOP_FIELDS_V1, 'coverage_scope']);
const MODEL_FIELDS_V1 = new Set(['id', 'package_digest', 'parameter_digest']);
const MODEL_FIELDS_V2 = new Set(['id', 'source', 'checkpoint']);
const SOURCE_FIELDS = new Set(['repository', 'revision', 'package_path', 'package_blob', 'spec_path']);
const CHECKPOINT_FIELDS = new Set(['run_id', 'batch', 'sha256', 'layout_schema', 'tensor_count', 'parameter_count', 'parameter_dtype', 'parameter_bytes']);
const TENSOR_FIELDS = new Set(['provider_package', 'provider_version', 'provider_revision', 'tensor_program_contract']);
const VALUE_FIELDS = new Set(['name', 'dtype', 'shape']);
const OP_FIELDS = new Set(['id', 'kind', 'operator']);
const RESOURCE_FIELDS = new Set(['parameter_bytes', 'workspace_bytes_per_item', 'input_bytes_per_item', 'output_bytes_per_item']);
const CAPABILITY_V1_FIELDS = new Set(['contract', 'provider_package', 'provider_version', 'provider_revision', 'tensor_program_contract', 'limits', 'dtypes', 'operations']);
const CAPABILITY_V2_FIELDS = new Set(['contract', 'provider_package', 'provider_version', 'provider_revision', 'tensor_program_contracts', 'extension_operation_contracts', 'limits', 'dtypes', 'operations']);
const CAPABILITY_V3_FIELDS = new Set([...CAPABILITY_V2_FIELDS, 'contract_composition_order']);
const CAPABILITY_V2_CONTRACT_KEYS = new Set(['base', 'spec0010']);
const CAPABILITY_V3_CONTRACT_KEYS = new Set(['base', 'spec0010', 'spec0011', 'spec0010_spec0011']);
const CAPABILITY_V3_CHILD_KEYS = new Set(['spec0010', 'spec0011']);
const CAPABILITY_V3_COMPOSITION_ORDER = Object.freeze(['spec0010', 'spec0011']);

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
function gitSha(value, field) {
  if (typeof value !== 'string' || !HEX40.test(value)) fail('VECTOR_MODEL_GIT_IDENTITY_INVALID', `${field} must be a lowercase 40-hex Git object id.`);
}
function relativePath(value, field) {
  if (typeof value !== 'string' || value.length < 1 || value.startsWith('/') || value.includes('\\') || value.split('/').includes('..')) fail('VECTOR_MODEL_SOURCE_PATH_INVALID', `${field} must be a normalized repository-relative path.`);
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

function normalizeOperations(raw) {
  if (!plain(raw)) fail('VECTOR_TENSOR_CAPABILITY_INVALID', 'Capability snapshot operations must be an object.');
  const operations = new Map();
  for (const [kind, operators] of Object.entries(raw)) {
    name(kind, `operations.${kind}`);
    if (operators === null) operations.set(kind, null);
    else {
      if (!Array.isArray(operators) || operators.some((operator) => typeof operator !== 'string' || !NAME.test(operator))) fail('VECTOR_TENSOR_CAPABILITY_INVALID', `operations.${kind} must be null or bounded operator names.`);
      operations.set(kind, new Set(operators));
    }
  }
  return operations;
}

function normalizeCommonCapabilities(raw) {
  if (raw.provider_package !== 'cuda-js-tensor') fail('VECTOR_TENSOR_PROVIDER_INVALID', 'Capability snapshot provider must be cuda-js-tensor.');
  if (typeof raw.provider_version !== 'string') fail('VECTOR_TENSOR_CAPABILITY_IDENTITY_INVALID', 'Capability snapshot provider version is missing.');
  gitSha(raw.provider_revision, 'provider_revision');
  if (!plain(raw.limits) || !Array.isArray(raw.dtypes)) fail('VECTOR_TENSOR_CAPABILITY_INVALID', 'Capability snapshot limits/dtypes are incomplete.');
  const maxInputs = safeNonnegative(raw.limits.max_inputs, 'limits.max_inputs');
  const maxNodes = safeNonnegative(raw.limits.max_nodes, 'limits.max_nodes');
  const maxOutputs = safeNonnegative(raw.limits.max_outputs, 'limits.max_outputs');
  const maxRank = safeNonnegative(raw.limits.max_rank, 'limits.max_rank');
  const dtypes = new Set(raw.dtypes);
  for (const dtype of dtypes) if (!Object.hasOwn(DTYPE_BYTES, dtype)) fail('VECTOR_TENSOR_CAPABILITY_INVALID', `Unknown dtype '${dtype}' in capability snapshot.`);
  return { maxInputs, maxNodes, maxOutputs, maxRank, dtypes, operations: normalizeOperations(raw.operations) };
}

function normalizeContractCapabilities(raw, { schema, fields, contractKeys, extensionKeys, contractOrder }) {
  exact(raw, fields, 'VECTOR_TENSOR_CAPABILITY_INVALID', 'capability snapshot');
  if (!plain(raw.tensor_program_contracts) || !plain(raw.extension_operation_contracts)) fail('VECTOR_TENSOR_CAPABILITY_INVALID', `${schema} capability snapshot requires contract maps.`);
  exact(raw.tensor_program_contracts, contractKeys, 'VECTOR_TENSOR_CAPABILITY_INVALID', 'tensor_program_contracts');
  const contracts = {};
  for (const key of contractKeys) {
    const value = raw.tensor_program_contracts[key];
    if (typeof value !== 'string' || value.length < 1) fail('VECTOR_TENSOR_CAPABILITY_IDENTITY_INVALID', `tensor_program_contracts.${key} is missing.`);
    contracts[key] = value;
  }
  const extensionContracts = new Map();
  for (const [operation, contractKey] of Object.entries(raw.extension_operation_contracts)) {
    if (typeof operation !== 'string' || operation.length < 1 || !extensionKeys.has(contractKey)) fail('VECTOR_TENSOR_CAPABILITY_INVALID', 'extension_operation_contracts contains an invalid operation/contract mapping.');
    extensionContracts.set(operation, contractKey);
  }
  const common = normalizeCommonCapabilities(raw);
  return Object.freeze({
    schema,
    identity: Object.freeze({ providerPackage: raw.provider_package, providerVersion: raw.provider_version, providerRevision: raw.provider_revision }),
    contracts: Object.freeze(contracts),
    extensionContracts,
    contractOrder: Object.freeze([...contractOrder]),
    ...common,
  });
}

export function normalizeCapabilities(raw) {
  if (!plain(raw)) fail('VECTOR_TENSOR_CAPABILITY_CONTRACT_INVALID', 'Tensor capability snapshot must be an object.');
  if (raw.contract === CAPABILITIES_V1) {
    exact(raw, CAPABILITY_V1_FIELDS, 'VECTOR_TENSOR_CAPABILITY_INVALID', 'capability snapshot');
    if (typeof raw.tensor_program_contract !== 'string') fail('VECTOR_TENSOR_CAPABILITY_IDENTITY_INVALID', 'Capability snapshot TensorProgram contract is missing.');
    const common = normalizeCommonCapabilities(raw);
    return Object.freeze({
      schema: CAPABILITIES_V1,
      identity: Object.freeze({ providerPackage: raw.provider_package, providerVersion: raw.provider_version, providerRevision: raw.provider_revision }),
      contracts: Object.freeze({ base: raw.tensor_program_contract }),
      extensionContracts: new Map(),
      contractOrder: Object.freeze([]),
      ...common,
    });
  }
  if (raw.contract === CAPABILITIES_V2) {
    return normalizeContractCapabilities(raw, {
      schema: CAPABILITIES_V2,
      fields: CAPABILITY_V2_FIELDS,
      contractKeys: CAPABILITY_V2_CONTRACT_KEYS,
      extensionKeys: CAPABILITY_V2_CONTRACT_KEYS,
      contractOrder: ['spec0010'],
    });
  }
  if (raw.contract !== CAPABILITIES_V3) fail('VECTOR_TENSOR_CAPABILITY_CONTRACT_INVALID', 'Unknown Tensor capability snapshot contract.');
  if (!Array.isArray(raw.contract_composition_order) || raw.contract_composition_order.length !== CAPABILITY_V3_COMPOSITION_ORDER.length || raw.contract_composition_order.some((key, index) => key !== CAPABILITY_V3_COMPOSITION_ORDER[index])) {
    fail('VECTOR_TENSOR_CAPABILITY_INVALID', 'v3 contract_composition_order must be the canonical SPEC-0010 then SPEC-0011 child order.');
  }
  return normalizeContractCapabilities(raw, {
    schema: CAPABILITIES_V3,
    fields: CAPABILITY_V3_FIELDS,
    contractKeys: CAPABILITY_V3_CONTRACT_KEYS,
    extensionKeys: CAPABILITY_V3_CHILD_KEYS,
    contractOrder: raw.contract_composition_order,
  });
}

function normalizeV1Model(model) {
  exact(model, MODEL_FIELDS_V1, 'VECTOR_MODEL_IDENTITY_INVALID', 'model');
  name(model.id, 'model.id');
  digest(model.package_digest, 'model.package_digest');
  digest(model.parameter_digest, 'model.parameter_digest');
  return Object.freeze({ id: model.id, packageDigest: model.package_digest, parameterDigest: model.parameter_digest, provenance: null, checkpoint: null });
}

function normalizeV2Model(model) {
  exact(model, MODEL_FIELDS_V2, 'VECTOR_MODEL_IDENTITY_INVALID', 'model');
  name(model.id, 'model.id');
  exact(model.source, SOURCE_FIELDS, 'VECTOR_MODEL_SOURCE_IDENTITY_INVALID', 'model.source');
  if (typeof model.source.repository !== 'string' || !REPOSITORY.test(model.source.repository)) fail('VECTOR_MODEL_SOURCE_IDENTITY_INVALID', 'model.source.repository must be owner/name.');
  gitSha(model.source.revision, 'model.source.revision');
  relativePath(model.source.package_path, 'model.source.package_path');
  gitSha(model.source.package_blob, 'model.source.package_blob');
  relativePath(model.source.spec_path, 'model.source.spec_path');

  exact(model.checkpoint, CHECKPOINT_FIELDS, 'VECTOR_MODEL_CHECKPOINT_INVALID', 'model.checkpoint');
  name(model.checkpoint.run_id, 'model.checkpoint.run_id');
  name(model.checkpoint.layout_schema, 'model.checkpoint.layout_schema');
  const batch = safeNonnegative(model.checkpoint.batch, 'model.checkpoint.batch');
  digest(model.checkpoint.sha256, 'model.checkpoint.sha256');
  const tensorCount = safeNonnegative(model.checkpoint.tensor_count, 'model.checkpoint.tensor_count');
  const parameterCount = safeNonnegative(model.checkpoint.parameter_count, 'model.checkpoint.parameter_count');
  if (!Object.hasOwn(DTYPE_BYTES, model.checkpoint.parameter_dtype)) fail('VECTOR_MODEL_DTYPE_UNSUPPORTED', 'model.checkpoint.parameter_dtype is unsupported.');
  const parameterBytes = safeNonnegative(model.checkpoint.parameter_bytes, 'model.checkpoint.parameter_bytes');
  const expectedBytes = checkedMultiply(parameterCount, DTYPE_BYTES[model.checkpoint.parameter_dtype], 'model.checkpoint.parameter_bytes');
  if (parameterBytes !== expectedBytes) fail('VECTOR_MODEL_PARAMETER_LAYOUT_INVALID', 'Checkpoint parameter bytes do not match parameter count and dtype.', { expected: expectedBytes, actual: parameterBytes });
  if (tensorCount < 1 || parameterCount < 1) fail('VECTOR_MODEL_PARAMETER_LAYOUT_INVALID', 'A frozen real checkpoint must contain at least one tensor and parameter.');

  return Object.freeze({
    id: model.id,
    packageDigest: null,
    parameterDigest: model.checkpoint.sha256,
    provenance: Object.freeze({ repository: model.source.repository, revision: model.source.revision, packagePath: model.source.package_path, packageBlob: model.source.package_blob, specPath: model.source.spec_path }),
    checkpoint: Object.freeze({ runId: model.checkpoint.run_id, batch, sha256: model.checkpoint.sha256, layoutSchema: model.checkpoint.layout_schema, tensorCount, parameterCount, parameterDtype: model.checkpoint.parameter_dtype, parameterBytes }),
  });
}

function operationKey(operation) { return operation.operator === undefined ? operation.kind : `${operation.kind}:${operation.operator}`; }

function operationRequirement(operation, capabilities, index) {
  exact(operation, OP_FIELDS, 'VECTOR_MODEL_OPERATION_INVALID', `operations[${index}]`);
  name(operation.id, `operations[${index}].id`);
  if (typeof operation.kind !== 'string' || !NAME.test(operation.kind)) fail('VECTOR_MODEL_OPERATION_INVALID', `operations[${index}].kind is not a bounded identifier.`);
  const accepted = capabilities.operations.get(operation.kind);
  if (accepted === undefined) {
    if (operation.operator !== undefined) fail('VECTOR_MODEL_OPERATION_INVALID', `Unknown operation kind '${operation.kind}' must not invent an operator contract.`);
    return { gap: Object.freeze({ id: operation.id, kind: operation.kind, operator: null, reason: 'operation_kind_unavailable' }), kind: operation.kind, contractKey: null };
  }
  if (accepted === null) {
    if (operation.operator !== undefined) fail('VECTOR_MODEL_OPERATION_INVALID', `Operation '${operation.kind}' must not declare an operator.`);
    return { gap: null, kind: operation.kind, contractKey: capabilities.extensionContracts.get(operation.kind) ?? 'base' };
  }
  if (typeof operation.operator !== 'string') fail('VECTOR_MODEL_OPERATION_INVALID', `Operation '${operation.kind}' requires an operator.`);
  if (!accepted.has(operation.operator)) return { gap: Object.freeze({ id: operation.id, kind: operation.kind, operator: operation.operator, reason: 'operator_unavailable' }), kind: operation.kind, contractKey: null };
  return { gap: null, kind: operation.kind, contractKey: capabilities.extensionContracts.get(operationKey(operation)) ?? capabilities.extensionContracts.get(operation.kind) ?? 'base' };
}

function requiredContractKey(capabilities, requiredChildren) {
  if (requiredChildren.size === 0) return 'base';
  const ordered = capabilities.contractOrder.filter((key) => requiredChildren.has(key));
  if (ordered.length !== requiredChildren.size) fail('VECTOR_TENSOR_CAPABILITY_INVALID', 'Covered operations require a Tensor contract child absent from canonical composition order.');
  return ordered.join('_');
}

function coverageResult({ manifest, contract, model, capabilities, actualTensorContract, requiredContractKey: selectedContractKey, inputBytes, outputBytes, operationKinds, gaps, resources }) {
  const real = manifest.source_class === 'frozen_real_model';
  const workspaceResolved = resources.workspaceBytesPerItem !== null;
  const realReady = real && gaps.length === 0 && workspaceResolved;
  const status = !real
    ? 'covered_synthetic_fixture'
    : gaps.length > 0
      ? 'frozen_real_model_capability_gap'
      : workspaceResolved
        ? 'covered_real_model'
        : 'frozen_real_model_workspace_unresolved';
  return Object.freeze({
    contract: 'vector-model-tensor-coverage-result-v2',
    manifest_contract: contract,
    coverage_scope: manifest.coverage_scope ?? 'synthetic_contract_fixture_v1',
    status,
    real_model_ready: realReady,
    model_id: model.id,
    model_package_digest: model.packageDigest,
    model_provenance: model.provenance,
    checkpoint: model.checkpoint,
    tensor_provider_revision: capabilities.identity.providerRevision,
    tensor_program_contract: actualTensorContract,
    required_tensor_program_contract: capabilities.contracts[selectedContractKey],
    input_count: manifest.inputs.length,
    operation_requirement_count: manifest.operations.length,
    output_count: manifest.outputs.length,
    operation_kinds: [...operationKinds].sort(),
    missing_capabilities: gaps,
    minimum_input_bytes_per_item: inputBytes,
    minimum_output_bytes_per_item: outputBytes,
    declared_resources: resources,
  });
}

export function verifyModelTensorCoverage(manifest, capabilityRecord, { requireReal = false } = {}) {
  if (!plain(manifest)) fail('VECTOR_MODEL_MANIFEST_INVALID', 'manifest must be an object.');
  const contract = manifest.contract;
  if (contract === MANIFEST_V1) exact(manifest, TOP_FIELDS_V1, 'VECTOR_MODEL_MANIFEST_INVALID', 'manifest');
  else if (contract === MANIFEST_V2) exact(manifest, TOP_FIELDS_V2, 'VECTOR_MODEL_MANIFEST_INVALID', 'manifest');
  else fail('VECTOR_MODEL_MANIFEST_CONTRACT_INVALID', `Expected ${MANIFEST_V1} or ${MANIFEST_V2}.`);

  if (!SOURCE_CLASSES.has(manifest.source_class)) fail('VECTOR_MODEL_SOURCE_CLASS_INVALID', 'source_class is not recognized.');
  if (contract === MANIFEST_V2 && manifest.source_class !== 'frozen_real_model') fail('VECTOR_MODEL_SOURCE_CLASS_INVALID', 'v2 is reserved for frozen real-model evidence.');
  if (contract === MANIFEST_V2 && manifest.coverage_scope !== 'model_semantic_capability_matrix_v1') fail('VECTOR_MODEL_COVERAGE_SCOPE_INVALID', 'v2 coverage_scope must be model_semantic_capability_matrix_v1.');
  if (requireReal && manifest.source_class !== 'frozen_real_model') fail('VECTOR_MODEL_REAL_MODEL_REQUIRED', 'A synthetic fixture cannot satisfy first-real-model readiness.');

  const model = contract === MANIFEST_V1 ? normalizeV1Model(manifest.model) : normalizeV2Model(manifest.model);
  const capabilities = normalizeCapabilities(capabilityRecord);
  exact(manifest.tensor_contract, TENSOR_FIELDS, 'VECTOR_MODEL_TENSOR_CONTRACT_INVALID', 'tensor_contract');
  const actualTensorContract = manifest.tensor_contract.tensor_program_contract;
  const expectedIdentity = capabilities.identity;
  if (manifest.tensor_contract.provider_package !== expectedIdentity.providerPackage || manifest.tensor_contract.provider_version !== expectedIdentity.providerVersion || manifest.tensor_contract.provider_revision !== expectedIdentity.providerRevision) {
    fail('VECTOR_MODEL_TENSOR_CONTRACT_MISMATCH', 'Model manifest is not bound to the pinned Tensor provider identity.', { expected: expectedIdentity, actual: manifest.tensor_contract });
  }

  if (!Array.isArray(manifest.inputs) || manifest.inputs.length < 1 || manifest.inputs.length > capabilities.maxInputs) fail('VECTOR_MODEL_INPUT_LIMIT', 'Model inputs exceed the pinned TensorProgram bounds.');
  if (!Array.isArray(manifest.outputs) || manifest.outputs.length < 1 || manifest.outputs.length > capabilities.maxOutputs) fail('VECTOR_MODEL_OUTPUT_LIMIT', 'Model outputs exceed the pinned TensorProgram bounds.');
  if (!Array.isArray(manifest.operations) || manifest.operations.length > capabilities.maxNodes) fail('VECTOR_MODEL_OPERATION_LIMIT', 'Model operation requirements exceed the pinned TensorProgram bounds.');

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
  const gaps = [];
  const requiredChildren = new Set();
  for (const [index, operation] of manifest.operations.entries()) {
    const requirement = operationRequirement(operation, capabilities, index);
    if (seenOperations.has(operation.id)) fail('VECTOR_MODEL_OPERATION_DUPLICATE', `Duplicate operation id '${operation.id}'.`);
    seenOperations.add(operation.id);
    operationKinds.add(requirement.kind);
    if (requirement.gap) {
      if (contract === MANIFEST_V1) {
        if (requirement.gap.reason === 'operation_kind_unavailable') fail('VECTOR_MODEL_OPERATION_UNSUPPORTED', `Operation kind '${operation.kind}' is not covered by the pinned public TensorProgram contract.`, { id: operation.id, kind: operation.kind });
        fail('VECTOR_MODEL_OPERATOR_UNSUPPORTED', `Operator '${operation.operator}' is not covered for '${operation.kind}'.`, { id: operation.id, kind: operation.kind, operator: operation.operator });
      }
      gaps.push(requirement.gap);
    } else if (requirement.contractKey !== 'base') requiredChildren.add(requirement.contractKey);
  }
  gaps.sort((a, b) => `${a.kind}:${a.operator ?? ''}:${a.id}`.localeCompare(`${b.kind}:${b.operator ?? ''}:${b.id}`));

  const selectedContractKey = requiredContractKey(capabilities, requiredChildren);
  const requiredTensorContract = capabilities.contracts[selectedContractKey];
  if (typeof requiredTensorContract !== 'string' || actualTensorContract !== requiredTensorContract) {
    fail('VECTOR_MODEL_TENSOR_CONTRACT_MISMATCH', 'Model manifest TensorProgram contract does not match the exact contract selected by its covered operations.', { required: requiredTensorContract ?? null, actual: actualTensorContract, required_contract_key: selectedContractKey });
  }

  exact(manifest.resources, RESOURCE_FIELDS, 'VECTOR_MODEL_RESOURCE_INVALID', 'resources');
  const parameterBytes = safeNonnegative(manifest.resources.parameter_bytes, 'resources.parameter_bytes');
  if (model.checkpoint && parameterBytes !== model.checkpoint.parameterBytes) fail('VECTOR_MODEL_RESOURCE_MISMATCH', 'resources.parameter_bytes must equal the frozen checkpoint parameter bytes.', { checkpoint: model.checkpoint.parameterBytes, declared: parameterBytes });
  let workspaceBytesPerItem = manifest.resources.workspace_bytes_per_item;
  if (workspaceBytesPerItem !== null) workspaceBytesPerItem = safeNonnegative(workspaceBytesPerItem, 'resources.workspace_bytes_per_item');
  else if (contract === MANIFEST_V1) fail('VECTOR_MODEL_RESOURCE_INVALID', 'v1 resources.workspace_bytes_per_item must be a nonnegative safe integer.');
  const resources = Object.freeze({
    parameterBytes,
    workspaceBytesPerItem,
    inputBytesPerItem: safeNonnegative(manifest.resources.input_bytes_per_item, 'resources.input_bytes_per_item'),
    outputBytesPerItem: safeNonnegative(manifest.resources.output_bytes_per_item, 'resources.output_bytes_per_item'),
  });
  if (resources.inputBytesPerItem < inputBytes) fail('VECTOR_MODEL_RESOURCE_UNDERSIZED', 'Declared input bytes are smaller than the tensor specification requires.', { required: inputBytes, declared: resources.inputBytesPerItem });
  if (resources.outputBytesPerItem < outputBytes) fail('VECTOR_MODEL_RESOURCE_UNDERSIZED', 'Declared output bytes are smaller than the tensor specification requires.', { required: outputBytes, declared: resources.outputBytesPerItem });

  const result = coverageResult({ manifest, contract, model, capabilities, actualTensorContract, requiredContractKey: selectedContractKey, inputBytes, outputBytes, operationKinds, gaps, resources });
  if (requireReal && gaps.length > 0) fail('VECTOR_MODEL_TENSOR_CAPABILITY_GAP', 'Frozen real model requires public Tensor capabilities not present in the pinned contract.', { missing_capabilities: gaps });
  if (requireReal && resources.workspaceBytesPerItem === null) fail('VECTOR_MODEL_WORKSPACE_UNRESOLVED', 'Frozen real model capability coverage is complete but TensorPlan workspace is not yet frozen.');
  return result;
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
    const body = { contract: 'vector-model-tensor-coverage-result-v2', status: 'failed', code: error?.code ?? 'VECTOR_MODEL_COVERAGE_ERROR', message: error?.message ?? String(error), detail: error?.detail ?? null };
    process.stderr.write(`${JSON.stringify(body)}\n`);
    process.exitCode = 1;
  }
}
