import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ORACLE_CONTRACT = 'vector-checkpoint-numerical-oracle-v1';
const OBSERVATION_CONTRACT = 'vector-checkpoint-numerical-observation-v1';
const RESULT_CONTRACT = 'vector-checkpoint-numerical-comparison-v1';
const MODEL_ID = 'compact_chessformer_gab_v1';
const PRODUCER_REPOSITORY = 'iteathen/the_restaurant';
const PRODUCER_REVISION = '8c7d75672cee36aa2a39fbddf713041552770b22';
const CHECKPOINT_RUN = 'run_1784364601_12348';
const CHECKPOINT_BATCH = 54499;
const CHECKPOINT_SHA256 = '62dec13c22a4414db6b78ea9b6ca76bcf6f29a16a963c01d13d947d158b09c7e';
const TENSOR_PACKAGE = 'cuda-js-tensor';
const TENSOR_VERSION = '0.1.0-alpha.6';
const TENSOR_REVISION = '0da2c70a0a10df908a33e842aa4ba3dbd7605c48';
const CUDA_JS_REVISION = '45a9ef15537b52d6fd7c615b7e596676dfd00587';
const PROGRAM_IDENTITY = 'tensor-program-v1:3ef2b2fafdc3bbfa8b676668198b6f1bc91f0657adb3d04bf8e0a3c2d3644358';
const PLAN_IDENTITY = 'tensor-plan-v1:ae83f14f81e5417aed2695f1153266470370d6aecb6c3f6114ab50c201a13dba';
const DEVICE_PROGRAM_IDENTITY = 'tensor-device-program-v1:70d86fd70c97d8b585eb89a9a1cace19572f1d1fe27df11e155f9ce355eed2fb';
const ITEM_CAPACITY = 2;
const INPUT_SHAPE = Object.freeze([1, 17, 8, 8]);
const POLICY_SHAPE = Object.freeze([1, 4162]);
const VALUE_SHAPE = Object.freeze([1, 1]);
const HEX_40 = /^[0-9a-f]{40}$/;
const HEX_64 = /^[0-9a-f]{64}$/;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export class OracleError extends Error {
  constructor(code, message, detail = null) {
    super(message);
    this.name = 'OracleError';
    this.code = code;
    this.detail = detail;
  }
}

function fail(code, message, detail = null) { throw new OracleError(code, message, detail); }
function plain(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function exact(value, fields, code, label) {
  if (!plain(value)) fail(code, `${label} must be an object.`);
  const allowed = new Set(fields);
  for (const key of Object.keys(value)) if (!allowed.has(key)) fail(code, `${label} contains unknown field '${key}'.`);
  for (const key of fields) if (!Object.hasOwn(value, key)) fail(code, `${label} is missing '${key}'.`);
}
function identifier(value, field) {
  if (typeof value !== 'string' || !IDENTIFIER.test(value)) fail('VECTOR_MODEL_ORACLE_INVALID', `${field} must be a bounded identifier.`);
  return value;
}
function exactString(value, expected, field, code = 'VECTOR_MODEL_ORACLE_IDENTITY') {
  if (value !== expected) fail(code, `${field} must equal '${expected}'.`, { expected, actual: value ?? null });
}
function exactInteger(value, expected, field) {
  if (!Number.isSafeInteger(value) || value !== expected) fail('VECTOR_MODEL_ORACLE_IDENTITY', `${field} must equal ${expected}.`, { expected, actual: value ?? null });
}
function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function elementCount(shape) { return shape.reduce((product, extent) => product * extent, 1); }
function sameShape(actual, expected, field) {
  if (!Array.isArray(actual) || actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    fail('VECTOR_MODEL_ORACLE_TENSOR_INVALID', `${field}.shape is incompatible.`, { expected, actual });
  }
}
function finiteTolerance(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) fail('VECTOR_MODEL_ORACLE_CRITERION_INVALID', `${field} must be a finite non-negative number.`);
  return value;
}

function normalizeModelIdentity(raw, label) {
  exact(raw, ['id', 'producer', 'checkpoint', 'precision'], 'VECTOR_MODEL_ORACLE_IDENTITY', label);
  exactString(raw.id, MODEL_ID, `${label}.id`);
  exact(raw.producer, ['repository', 'revision'], 'VECTOR_MODEL_ORACLE_IDENTITY', `${label}.producer`);
  exactString(raw.producer.repository, PRODUCER_REPOSITORY, `${label}.producer.repository`);
  exactString(raw.producer.revision, PRODUCER_REVISION, `${label}.producer.revision`);
  exact(raw.checkpoint, ['run_id', 'batch', 'sha256'], 'VECTOR_MODEL_ORACLE_IDENTITY', `${label}.checkpoint`);
  exactString(raw.checkpoint.run_id, CHECKPOINT_RUN, `${label}.checkpoint.run_id`);
  exactInteger(raw.checkpoint.batch, CHECKPOINT_BATCH, `${label}.checkpoint.batch`);
  exactString(raw.checkpoint.sha256, CHECKPOINT_SHA256, `${label}.checkpoint.sha256`);
  exactString(raw.precision, 'f32', `${label}.precision`);
  return Object.freeze({
    id: MODEL_ID,
    producer: Object.freeze({ repository: PRODUCER_REPOSITORY, revision: PRODUCER_REVISION }),
    checkpoint: Object.freeze({ runId: CHECKPOINT_RUN, batch: CHECKPOINT_BATCH, sha256: CHECKPOINT_SHA256 }),
    precision: 'f32',
  });
}

function decodeTensor(raw, expectedShape, field) {
  exact(raw, ['dtype', 'shape', 'encoding', 'sha256', 'bytes_base64'], 'VECTOR_MODEL_ORACLE_TENSOR_INVALID', field);
  exactString(raw.dtype, 'f32', `${field}.dtype`, 'VECTOR_MODEL_ORACLE_TENSOR_INVALID');
  sameShape(raw.shape, expectedShape, field);
  exactString(raw.encoding, 'base64-le-f32', `${field}.encoding`, 'VECTOR_MODEL_ORACLE_TENSOR_INVALID');
  if (typeof raw.sha256 !== 'string' || !HEX_64.test(raw.sha256)) fail('VECTOR_MODEL_ORACLE_TENSOR_INVALID', `${field}.sha256 must be lowercase sha256 hex.`);
  if (typeof raw.bytes_base64 !== 'string' || !BASE64.test(raw.bytes_base64)) fail('VECTOR_MODEL_ORACLE_TENSOR_INVALID', `${field}.bytes_base64 must be canonical base64.`);
  const bytes = Buffer.from(raw.bytes_base64, 'base64');
  if (bytes.toString('base64') !== raw.bytes_base64) fail('VECTOR_MODEL_ORACLE_TENSOR_INVALID', `${field}.bytes_base64 is not canonical.`);
  const expectedBytes = elementCount(expectedShape) * 4;
  if (bytes.length !== expectedBytes) fail('VECTOR_MODEL_ORACLE_TENSOR_INVALID', `${field} byte length is incompatible.`, { expected: expectedBytes, actual: bytes.length });
  if (sha256(bytes) !== raw.sha256) fail('VECTOR_MODEL_ORACLE_TENSOR_INVALID', `${field}.sha256 does not match decoded bytes.`);
  const values = new Float32Array(elementCount(expectedShape));
  for (let index = 0; index < values.length; index += 1) {
    const value = bytes.readFloatLE(index * 4);
    if (!Number.isFinite(value)) fail('VECTOR_MODEL_ORACLE_NONFINITE', `${field}[${index}] is not finite.`);
    values[index] = value;
  }
  return Object.freeze({ dtype: 'f32', shape: Object.freeze([...expectedShape]), sha256: raw.sha256, bytes, values });
}

function normalizeExpectedItem(raw, index) {
  exact(raw, ['id', 'input', 'outputs'], 'VECTOR_MODEL_ORACLE_INVALID', `oracle.items[${index}]`);
  const id = identifier(raw.id, `oracle.items[${index}].id`);
  exact(raw.outputs, ['policy', 'value'], 'VECTOR_MODEL_ORACLE_INVALID', `oracle.items[${index}].outputs`);
  return Object.freeze({
    id,
    input: decodeTensor(raw.input, INPUT_SHAPE, `oracle.items[${index}].input`),
    outputs: Object.freeze({
      policy: decodeTensor(raw.outputs.policy, POLICY_SHAPE, `oracle.items[${index}].outputs.policy`),
      value: decodeTensor(raw.outputs.value, VALUE_SHAPE, `oracle.items[${index}].outputs.value`),
    }),
  });
}

function normalizeCriterion(raw) {
  exact(raw, ['policy', 'value', 'basis'], 'VECTOR_MODEL_ORACLE_CRITERION_INVALID', 'oracle.criterion');
  identifier(raw.basis, 'oracle.criterion.basis');
  function head(value, label) {
    exact(value, ['absolute_tolerance', 'relative_tolerance'], 'VECTOR_MODEL_ORACLE_CRITERION_INVALID', label);
    return Object.freeze({
      absoluteTolerance: finiteTolerance(value.absolute_tolerance, `${label}.absolute_tolerance`),
      relativeTolerance: finiteTolerance(value.relative_tolerance, `${label}.relative_tolerance`),
    });
  }
  return Object.freeze({ policy: head(raw.policy, 'oracle.criterion.policy'), value: head(raw.value, 'oracle.criterion.value'), basis: raw.basis });
}

export function normalizeOracleReceipt(raw) {
  exact(raw, ['contract', 'source_class', 'model', 'oracle', 'criterion', 'items', 'required_occupancies'], 'VECTOR_MODEL_ORACLE_INVALID', 'oracle receipt');
  exactString(raw.contract, ORACLE_CONTRACT, 'oracle.contract', 'VECTOR_MODEL_ORACLE_CONTRACT_INVALID');
  exactString(raw.source_class, 'independent_checkpoint_oracle', 'oracle.source_class', 'VECTOR_MODEL_ORACLE_INDEPENDENCE_INVALID');
  const model = normalizeModelIdentity(raw.model, 'oracle.model');
  exact(raw.oracle, ['owner_repository', 'owner_revision', 'execution_contract', 'runtime', 'artifact', 'independence'], 'VECTOR_MODEL_ORACLE_INDEPENDENCE_INVALID', 'oracle.oracle');
  exactString(raw.oracle.owner_repository, PRODUCER_REPOSITORY, 'oracle.oracle.owner_repository', 'VECTOR_MODEL_ORACLE_INDEPENDENCE_INVALID');
  if (raw.oracle.owner_repository === 'iteathen/UCI-Arena-Vector') fail('VECTOR_MODEL_ORACLE_INDEPENDENCE_INVALID', 'Vector cannot own its own expected numerical outputs.');
  if (typeof raw.oracle.owner_revision !== 'string' || !HEX_40.test(raw.oracle.owner_revision)) fail('VECTOR_MODEL_ORACLE_INDEPENDENCE_INVALID', 'oracle.oracle.owner_revision must be an exact Git revision.');
  exactString(raw.oracle.owner_revision, PRODUCER_REVISION, 'oracle.oracle.owner_revision', 'VECTOR_MODEL_ORACLE_INDEPENDENCE_INVALID');
  exactString(raw.oracle.execution_contract, 'native_onnx_numeric_parity', 'oracle.oracle.execution_contract', 'VECTOR_MODEL_ORACLE_INDEPENDENCE_INVALID');
  exact(raw.oracle.runtime, ['name', 'version', 'provider'], 'VECTOR_MODEL_ORACLE_INDEPENDENCE_INVALID', 'oracle.oracle.runtime');
  identifier(raw.oracle.runtime.name, 'oracle.oracle.runtime.name');
  identifier(raw.oracle.runtime.version, 'oracle.oracle.runtime.version');
  identifier(raw.oracle.runtime.provider, 'oracle.oracle.runtime.provider');
  exact(raw.oracle.artifact, ['kind', 'sha256'], 'VECTOR_MODEL_ORACLE_INDEPENDENCE_INVALID', 'oracle.oracle.artifact');
  exactString(raw.oracle.artifact.kind, 'onnx', 'oracle.oracle.artifact.kind', 'VECTOR_MODEL_ORACLE_INDEPENDENCE_INVALID');
  if (typeof raw.oracle.artifact.sha256 !== 'string' || !HEX_64.test(raw.oracle.artifact.sha256)) fail('VECTOR_MODEL_ORACLE_INDEPENDENCE_INVALID', 'oracle.oracle.artifact.sha256 must be lowercase sha256 hex.');
  exact(raw.oracle.independence, ['vector_mapper_used', 'cuda_js_tensor_used'], 'VECTOR_MODEL_ORACLE_INDEPENDENCE_INVALID', 'oracle.oracle.independence');
  if (raw.oracle.independence.vector_mapper_used !== false || raw.oracle.independence.cuda_js_tensor_used !== false) {
    fail('VECTOR_MODEL_ORACLE_INDEPENDENCE_INVALID', 'Expected outputs must not be produced by Vector mapping or CUDA-JS-Tensor.');
  }
  if (!Array.isArray(raw.items) || raw.items.length !== ITEM_CAPACITY) fail('VECTOR_MODEL_ORACLE_INVALID', `oracle.items must contain exactly ${ITEM_CAPACITY} independent item cases.`);
  const items = raw.items.map(normalizeExpectedItem);
  if (new Set(items.map(({ id }) => id)).size !== items.length) fail('VECTOR_MODEL_ORACLE_INVALID', 'oracle item ids must be unique.');
  if (!Array.isArray(raw.required_occupancies) || raw.required_occupancies.length !== 2 || raw.required_occupancies[0] !== 'full-capacity-2' || raw.required_occupancies[1] !== 'partial-1-of-2') {
    fail('VECTOR_MODEL_ORACLE_OCCUPANCY_INVALID', 'required_occupancies must be canonical [full-capacity-2, partial-1-of-2].');
  }
  return Object.freeze({
    contract: ORACLE_CONTRACT,
    model,
    oracle: Object.freeze({
      ownerRepository: raw.oracle.owner_repository,
      ownerRevision: raw.oracle.owner_revision,
      executionContract: raw.oracle.execution_contract,
      runtime: Object.freeze({ ...raw.oracle.runtime }),
      artifact: Object.freeze({ ...raw.oracle.artifact }),
    }),
    criterion: normalizeCriterion(raw.criterion),
    items: Object.freeze(items),
  });
}

function normalizeObservedItem(raw, scenarioIndex, itemIndex, expectedById) {
  const label = `observation.scenarios[${scenarioIndex}].items[${itemIndex}]`;
  exact(raw, ['item_id', 'item_index', 'input_sha256', 'outputs'], 'VECTOR_MODEL_ORACLE_OBSERVATION_INVALID', label);
  const expected = expectedById.get(identifier(raw.item_id, `${label}.item_id`));
  if (!expected) fail('VECTOR_MODEL_ORACLE_OBSERVATION_INVALID', `${label}.item_id is not present in the oracle.`);
  if (!Number.isSafeInteger(raw.item_index) || raw.item_index < 0 || raw.item_index >= ITEM_CAPACITY) fail('VECTOR_MODEL_ORACLE_OBSERVATION_INVALID', `${label}.item_index is outside capacity.`);
  exactString(raw.input_sha256, expected.input.sha256, `${label}.input_sha256`, 'VECTOR_MODEL_ORACLE_INPUT_MISMATCH');
  exact(raw.outputs, ['policy', 'value'], 'VECTOR_MODEL_ORACLE_OBSERVATION_INVALID', `${label}.outputs`);
  return Object.freeze({
    itemId: expected.id,
    itemIndex: raw.item_index,
    expected,
    outputs: Object.freeze({
      policy: decodeTensor(raw.outputs.policy, POLICY_SHAPE, `${label}.outputs.policy`),
      value: decodeTensor(raw.outputs.value, VALUE_SHAPE, `${label}.outputs.value`),
    }),
  });
}

function normalizeCleanup(raw, label) {
  exact(raw, ['tensor_session_graceful', 'cuda_runtime_graceful'], 'VECTOR_MODEL_ORACLE_CLEANUP_INVALID', label);
  if (raw.tensor_session_graceful !== true || raw.cuda_runtime_graceful !== true) fail('VECTOR_MODEL_ORACLE_CLEANUP_INVALID', `${label} must prove graceful TensorSession and CUDA runtime cleanup.`);
  return Object.freeze({ tensorSessionGraceful: true, cudaRuntimeGraceful: true });
}

export function normalizeObservationReceipt(raw, oracle) {
  exact(raw, ['contract', 'source_class', 'model', 'tensor', 'scenarios'], 'VECTOR_MODEL_ORACLE_OBSERVATION_INVALID', 'observation receipt');
  exactString(raw.contract, OBSERVATION_CONTRACT, 'observation.contract', 'VECTOR_MODEL_ORACLE_CONTRACT_INVALID');
  exactString(raw.source_class, 'public_tensor_observation', 'observation.source_class', 'VECTOR_MODEL_ORACLE_OBSERVATION_INVALID');
  normalizeModelIdentity(raw.model, 'observation.model');
  exact(raw.tensor, ['package', 'version', 'revision', 'cuda_js_revision', 'program_identity', 'plan_identity', 'device_program_identity', 'item_capacity', 'execution_path'], 'VECTOR_MODEL_ORACLE_OBSERVATION_INVALID', 'observation.tensor');
  exactString(raw.tensor.package, TENSOR_PACKAGE, 'observation.tensor.package', 'VECTOR_MODEL_ORACLE_OBSERVATION_INVALID');
  exactString(raw.tensor.version, TENSOR_VERSION, 'observation.tensor.version', 'VECTOR_MODEL_ORACLE_OBSERVATION_INVALID');
  exactString(raw.tensor.revision, TENSOR_REVISION, 'observation.tensor.revision', 'VECTOR_MODEL_ORACLE_OBSERVATION_INVALID');
  exactString(raw.tensor.cuda_js_revision, CUDA_JS_REVISION, 'observation.tensor.cuda_js_revision', 'VECTOR_MODEL_ORACLE_OBSERVATION_INVALID');
  exactString(raw.tensor.program_identity, PROGRAM_IDENTITY, 'observation.tensor.program_identity', 'VECTOR_MODEL_ORACLE_OBSERVATION_INVALID');
  exactString(raw.tensor.plan_identity, PLAN_IDENTITY, 'observation.tensor.plan_identity', 'VECTOR_MODEL_ORACLE_OBSERVATION_INVALID');
  exactString(raw.tensor.device_program_identity, DEVICE_PROGRAM_IDENTITY, 'observation.tensor.device_program_identity', 'VECTOR_MODEL_ORACLE_OBSERVATION_INVALID');
  exactInteger(raw.tensor.item_capacity, ITEM_CAPACITY, 'observation.tensor.item_capacity');
  exactString(raw.tensor.execution_path, 'public-cuda-js-tensor-device-callable', 'observation.tensor.execution_path', 'VECTOR_MODEL_ORACLE_OBSERVATION_INVALID');
  if (!Array.isArray(raw.scenarios) || raw.scenarios.length !== 2) fail('VECTOR_MODEL_ORACLE_OCCUPANCY_INVALID', 'observation.scenarios must contain exactly the full and partial qualification scenarios.');
  const expectedById = new Map(oracle.items.map((item) => [item.id, item]));
  const scenarios = raw.scenarios.map((scenario, scenarioIndex) => {
    const label = `observation.scenarios[${scenarioIndex}]`;
    exact(scenario, ['id', 'active_items', 'items', 'cleanup'], 'VECTOR_MODEL_ORACLE_OBSERVATION_INVALID', label);
    identifier(scenario.id, `${label}.id`);
    if (!Number.isSafeInteger(scenario.active_items) || scenario.active_items < 1 || scenario.active_items > ITEM_CAPACITY) fail('VECTOR_MODEL_ORACLE_OCCUPANCY_INVALID', `${label}.active_items is invalid.`);
    if (!Array.isArray(scenario.items) || scenario.items.length !== scenario.active_items) fail('VECTOR_MODEL_ORACLE_OCCUPANCY_INVALID', `${label}.items length must equal active_items.`);
    const items = scenario.items.map((item, itemIndex) => normalizeObservedItem(item, scenarioIndex, itemIndex, expectedById));
    if (new Set(items.map(({ itemId }) => itemId)).size !== items.length || new Set(items.map(({ itemIndex }) => itemIndex)).size !== items.length) fail('VECTOR_MODEL_ORACLE_OCCUPANCY_INVALID', `${label} contains duplicate item ids or indices.`);
    return Object.freeze({ id: scenario.id, activeItems: scenario.active_items, items: Object.freeze(items), cleanup: normalizeCleanup(scenario.cleanup, `${label}.cleanup`) });
  });
  const full = scenarios.find(({ id }) => id === 'full-capacity-2');
  const partial = scenarios.find(({ id }) => id === 'partial-1-of-2');
  if (!full || full.activeItems !== 2 || !partial || partial.activeItems !== 1) fail('VECTOR_MODEL_ORACLE_OCCUPANCY_INVALID', 'full-capacity-2 and partial-1-of-2 scenarios are both required with exact occupancy.');
  if (full.items[0].itemIndex !== 0 || full.items[1].itemIndex !== 1 || partial.items[0].itemIndex !== 0) fail('VECTOR_MODEL_ORACLE_OCCUPANCY_INVALID', 'qualification scenarios must use canonical item indices 0/1 and partial index 0.');
  if (partial.items[0].itemId !== full.items[0].itemId) fail('VECTOR_MODEL_ORACLE_OCCUPANCY_INVALID', 'partial occupancy must repeat the full scenario item at index 0 to falsify occupancy coupling.');
  return Object.freeze({ contract: OBSERVATION_CONTRACT, scenarios: Object.freeze(scenarios) });
}

function compareHead(expected, observed, criterion, head, scenarioId, itemId) {
  let maxAbsoluteError = 0;
  let maxRelativeError = 0;
  for (let index = 0; index < expected.values.length; index += 1) {
    const reference = expected.values[index];
    const actual = observed.values[index];
    const absoluteError = Math.abs(actual - reference);
    const relativeError = reference === 0 ? (absoluteError === 0 ? 0 : Number.POSITIVE_INFINITY) : absoluteError / Math.abs(reference);
    if (absoluteError > maxAbsoluteError) maxAbsoluteError = absoluteError;
    if (relativeError > maxRelativeError) maxRelativeError = relativeError;
    const allowed = criterion.absoluteTolerance + criterion.relativeTolerance * Math.abs(reference);
    if (absoluteError > allowed) {
      fail('VECTOR_MODEL_ORACLE_MISMATCH', `${scenarioId}/${itemId}/${head}[${index}] exceeds the declared numerical criterion.`, {
        scenario: scenarioId,
        item: itemId,
        head,
        index,
        expected: reference,
        actual,
        absoluteError,
        allowed,
      });
    }
  }
  return Object.freeze({ maxAbsoluteError, maxRelativeError });
}

export function compareModelNumericalOracle(oracleRaw, observationRaw) {
  const oracle = normalizeOracleReceipt(oracleRaw);
  const observation = normalizeObservationReceipt(observationRaw, oracle);
  const comparisons = [];
  for (const scenario of observation.scenarios) {
    for (const item of scenario.items) {
      comparisons.push(Object.freeze({
        scenario: scenario.id,
        item: item.itemId,
        policy: compareHead(item.expected.outputs.policy, item.outputs.policy, oracle.criterion.policy, 'policy', scenario.id, item.itemId),
        value: compareHead(item.expected.outputs.value, item.outputs.value, oracle.criterion.value, 'value', scenario.id, item.itemId),
      }));
    }
  }
  return Object.freeze({
    contract: RESULT_CONTRACT,
    status: 'matched_independent_checkpoint_oracle',
    model: MODEL_ID,
    checkpoint_sha256: CHECKPOINT_SHA256,
    tensor_provider_revision: TENSOR_REVISION,
    cuda_js_revision: CUDA_JS_REVISION,
    item_capacity: ITEM_CAPACITY,
    occupancies: Object.freeze(['full-capacity-2', 'partial-1-of-2']),
    criterion: oracle.criterion,
    comparisons: Object.freeze(comparisons),
    cleanup: 'graceful',
  });
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--oracle' || token === '--observation') {
      const value = argv[++index];
      if (!value) fail('VECTOR_MODEL_ORACLE_CLI_INVALID', `${token} requires a path.`);
      args[token.slice(2)] = value;
    } else fail('VECTOR_MODEL_ORACLE_CLI_INVALID', `Unknown argument '${token}'.`);
  }
  if (!args.oracle || !args.observation) fail('VECTOR_MODEL_ORACLE_CLI_INVALID', 'Usage: node tools/verify-model-numerical-oracle.mjs --oracle <path> --observation <path>');
  return args;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const oracle = JSON.parse(fs.readFileSync(args.oracle, 'utf8'));
    const observation = JSON.parse(fs.readFileSync(args.observation, 'utf8'));
    process.stdout.write(`${JSON.stringify(compareModelNumericalOracle(oracle, observation), null, 2)}\n`);
  } catch (error) {
    if (error instanceof OracleError) {
      process.stderr.write(`${JSON.stringify({ contract: RESULT_CONTRACT, status: 'failed', code: error.code, message: error.message, detail: error.detail })}\n`);
      process.exitCode = 1;
    } else throw error;
  }
}
