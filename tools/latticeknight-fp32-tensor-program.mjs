import { TensorPlan, TensorProgram } from 'cuda-js-tensor';

export const LATTICEKNIGHT_FP32_PROGRAM_PROFILE = 'latticeknight-4m-fp32-tensor-program-v1';
export const LATTICEKNIGHT_PARAMETER_COUNT = 3_637_988;
export const LATTICEKNIGHT_PARAMETER_BYTES = 14_551_952;
export const LATTICEKNIGHT_CHECKPOINT_TENSOR_COUNT = 227;

const BOARD_TOKENS = 64;
const MODEL_WIDTH = 256;
const ENCODER_LAYERS = 8;
const ATTENTION_HEADS = 8;
const HEAD_DIMENSION = 32;
const FEED_FORWARD_WIDTH = 256;
const GAB_SQUARE_DIMENSION = 8;
const GAB_INTERMEDIATE_DIMENSION = 32;
const GAB_TEMPLATE_DIMENSION = 32;
const POLICY_PROJECTION_WIDTH = 128;
const PROMOTION_HIDDEN = 32;
const VALUE_HIDDEN = 128;
const POLICY_WIDTH = 4162;
const LAYER_NORM_EPSILON = 1.0e-5;

const PROMOTION_FROM = Object.freeze([
  8, 8,
  9, 9, 9,
  10, 10, 10,
  11, 11, 11,
  12, 12, 12,
  13, 13, 13,
  14, 14, 14,
  15, 15,
]);
const PROMOTION_TO = Object.freeze([
  0, 1,
  0, 1, 2,
  1, 2, 3,
  2, 3, 4,
  3, 4, 5,
  4, 5, 6,
  5, 6, 7,
  6, 7,
]);
const PROMOTION_BASE = Object.freeze(PROMOTION_FROM.map((from, index) => from * BOARD_TOKENS + PROMOTION_TO[index]));

const CONSTANT_SOURCE = Object.freeze([
  ['zero', 0],
  ['one', 1],
  ['two', 2],
  ['sqrt2', Math.SQRT2],
  ['layerNormEpsilon', LAYER_NORM_EPSILON],
  ['width32', 32],
  ['width64', 64],
  ['width256', 256],
  ['attentionScale', Math.sqrt(HEAD_DIMENSION)],
  ['policyScale', Math.sqrt(POLICY_PROJECTION_WIDTH)],
]);

function product(shape) {
  return shape.reduce((result, dimension) => result * dimension, 1);
}

function buildParameterLayout() {
  const entries = [];
  let elementCount = 0;

  const add = (name, shape) => {
    const count = product(shape);
    entries.push(Object.freeze({
      name,
      storageIndex: entries.length,
      shape: Object.freeze([...shape]),
      elementOffset: elementCount,
      elementCount: count,
      byteOffset: elementCount * 4,
      byteLength: count * 4,
    }));
    elementCount += count;
  };
  const linear = (prefix, outputWidth, inputWidth, bias = true) => {
    add(`${prefix}.weight`, [outputWidth, inputWidth]);
    if (bias) add(`${prefix}.bias`, [outputWidth]);
  };
  const layerNorm = (prefix, width) => {
    add(`${prefix}.weight`, [width]);
    add(`${prefix}.bias`, [width]);
  };

  linear('token_projection', MODEL_WIDTH, 17);
  add('gab_shared_templates', [4096, GAB_TEMPLATE_DIMENSION]);
  for (let layer = 0; layer < ENCODER_LAYERS; layer += 1) {
    const prefix = `encoder.layers.${layer}`;
    linear(`${prefix}.query`, MODEL_WIDTH, MODEL_WIDTH);
    linear(`${prefix}.key`, MODEL_WIDTH, MODEL_WIDTH);
    linear(`${prefix}.value`, MODEL_WIDTH, MODEL_WIDTH);
    linear(`${prefix}.attention_output`, MODEL_WIDTH, MODEL_WIDTH);
    linear(`${prefix}.gab_square`, GAB_SQUARE_DIMENSION, MODEL_WIDTH);
    linear(`${prefix}.gab_board`, GAB_INTERMEDIATE_DIMENSION, BOARD_TOKENS * GAB_SQUARE_DIMENSION);
    layerNorm(`${prefix}.gab_board_norm`, GAB_INTERMEDIATE_DIMENSION);
    linear(`${prefix}.gab_heads`, ATTENTION_HEADS * GAB_TEMPLATE_DIMENSION, GAB_INTERMEDIATE_DIMENSION);
    layerNorm(`${prefix}.gab_heads_norm`, ATTENTION_HEADS * GAB_TEMPLATE_DIMENSION);
    layerNorm(`${prefix}.attention_norm`, MODEL_WIDTH);
    linear(`${prefix}.feed_forward_input`, FEED_FORWARD_WIDTH, MODEL_WIDTH);
    linear(`${prefix}.feed_forward_output`, MODEL_WIDTH, FEED_FORWARD_WIDTH);
    layerNorm(`${prefix}.feed_forward_norm`, MODEL_WIDTH);
  }
  layerNorm('encoder.final_norm', MODEL_WIDTH);
  linear('policy.source', POLICY_PROJECTION_WIDTH, MODEL_WIDTH, false);
  linear('policy.destination', POLICY_PROJECTION_WIDTH, MODEL_WIDTH, false);
  linear('policy.promotion_source', PROMOTION_HIDDEN, MODEL_WIDTH);
  linear('policy.promotion_destination', PROMOTION_HIDDEN, MODEL_WIDTH);
  linear('policy.promotion_delta', 3, PROMOTION_HIDDEN);
  layerNorm('value.pool_norm', MODEL_WIDTH);
  linear('value.hidden', VALUE_HIDDEN, MODEL_WIDTH);
  linear('value.output', 1, VALUE_HIDDEN);

  if (entries.length !== LATTICEKNIGHT_CHECKPOINT_TENSOR_COUNT || elementCount !== LATTICEKNIGHT_PARAMETER_COUNT) {
    throw new Error(`Frozen checkpoint layout mismatch: tensors=${entries.length} elements=${elementCount}`);
  }

  return Object.freeze({
    schema: 'latticeknight-4m-flat-parameter-layout-v1',
    tensorCount: entries.length,
    elementCount,
    byteLength: elementCount * 4,
    dtype: 'f32',
    entries: Object.freeze(entries),
  });
}

function buildConstantLayout() {
  const values = Array.from(new Float32Array(CONSTANT_SOURCE.map(([, value]) => value)));
  const entries = CONSTANT_SOURCE.map(([name], index) => Object.freeze({ name, index, value: values[index] }));
  return Object.freeze({
    schema: 'latticeknight-4m-fp32-program-constants-v1',
    dtype: 'f32',
    elementCount: entries.length,
    byteLength: entries.length * 4,
    entries: Object.freeze(entries),
    values: Object.freeze(values),
  });
}

export function buildLatticeKnightFp32TensorProgram({ itemCapacity } = {}) {
  if (!Number.isSafeInteger(itemCapacity) || itemCapacity < 1) {
    const error = new Error('itemCapacity must be a positive safe integer.');
    error.code = 'VECTOR_LATTICEKNIGHT_ITEM_CAPACITY_INVALID';
    throw error;
  }

  const parameterLayout = buildParameterLayout();
  const constantLayout = buildConstantLayout();
  const parameterByName = new Map(parameterLayout.entries.map((entry) => [entry.name, entry]));
  const constantByName = new Map(constantLayout.entries.map((entry) => [entry.name, entry]));

  const program = TensorProgram.define((graph) => {
    const features = graph.input('features', {
      dtype: 'f32',
      capacityShape: [itemCapacity, 17, 8, 8],
      access: 'read',
      aliasGroup: 'latticeknight-features',
    });
    const parameters = graph.input('parameters', {
      dtype: 'f32',
      capacityShape: [parameterLayout.elementCount],
      access: 'read',
      aliasGroup: 'latticeknight-parameters',
    });
    const constants = graph.input('constants', {
      dtype: 'f32',
      capacityShape: [constantLayout.elementCount],
      access: 'read',
      aliasGroup: 'latticeknight-constants',
    });

    const parameterViews = new Map();
    const constantViews = new Map();

    const parameter = (name) => {
      let value = parameterViews.get(name);
      if (value) return value;
      const entry = parameterByName.get(name);
      if (!entry) throw new Error(`Unknown frozen parameter '${name}'.`);
      const sliced = graph.slice(parameters, [{ start: entry.elementOffset, length: entry.elementCount }]);
      value = graph.reshape(sliced, entry.shape);
      parameterViews.set(name, value);
      return value;
    };

    const constant = (name) => {
      let value = constantViews.get(name);
      if (value) return value;
      const entry = constantByName.get(name);
      if (!entry) throw new Error(`Unknown frozen constant '${name}'.`);
      value = graph.slice(constants, [{ start: entry.index, length: 1 }]);
      constantViews.set(name, value);
      return value;
    };

    const linear = (input, prefix, bias = true) => {
      const rawWeight = parameter(`${prefix}.weight`);
      const rank = input.spec.rank;
      if (rank !== 2 && rank !== 3) throw new Error(`Linear input rank ${rank} is unsupported for '${prefix}'.`);
      const weight = rank === 3
        ? graph.reshape(rawWeight, [1, ...rawWeight.spec.capacityShape])
        : rawWeight;
      let output = graph.matmul(input, weight, { transposeB: true });
      if (bias) output = graph.binary('add', output, parameter(`${prefix}.bias`));
      return output;
    };

    const divideBy = (input, name) => graph.binary('div', input, constant(name));

    const gelu = (input) => {
      const normalized = divideBy(input, 'sqrt2');
      const gaussian = graph.unary('erf', normalized);
      const shifted = graph.binary('add', gaussian, constant('one'));
      const scaled = graph.binary('mul', input, shifted);
      return divideBy(scaled, 'two');
    };

    const layerNorm = (input, prefix, width) => {
      const axis = input.spec.rank - 1;
      if (input.spec.capacityShape[axis] !== width) throw new Error(`LayerNorm width mismatch for '${prefix}'.`);
      const widthConstant = width === 32 ? 'width32' : width === 256 ? 'width256' : null;
      if (!widthConstant) throw new Error(`Unsupported frozen LayerNorm width ${width}.`);
      const sum = graph.reduce('sum', input, { axes: [axis], keepDimensions: true });
      const mean = divideBy(sum, widthConstant);
      const centered = graph.binary('sub', input, mean);
      const squared = graph.binary('mul', centered, centered);
      const varianceSum = graph.reduce('sum', squared, { axes: [axis], keepDimensions: true });
      const variance = divideBy(varianceSum, widthConstant);
      const stabilized = graph.binary('add', variance, constant('layerNormEpsilon'));
      const deviation = graph.unary('sqrt', stabilized);
      const normalized = graph.binary('div', centered, deviation);
      const scaled = graph.binary('mul', normalized, parameter(`${prefix}.weight`));
      return graph.binary('add', scaled, parameter(`${prefix}.bias`));
    };

    const softmaxLast = (input) => {
      const axis = input.spec.rank - 1;
      const maximum = graph.reduce('maximum', input, { axes: [axis], keepDimensions: true });
      const shifted = graph.binary('sub', input, maximum);
      const exponentials = graph.unary('exp', shifted);
      const denominator = graph.reduce('sum', exponentials, { axes: [axis], keepDimensions: true });
      return graph.binary('div', exponentials, denominator);
    };

    const relu = (input) => graph.binary('maximum', input, constant('zero'));

    let tokens = graph.contiguous(graph.permute(features, [0, 2, 3, 1]));
    tokens = graph.reshape(tokens, [itemCapacity, BOARD_TOKENS, 17]);
    tokens = linear(tokens, 'token_projection');

    const sharedTemplates = parameter('gab_shared_templates');
    const sharedTemplatesBatch = graph.reshape(sharedTemplates, [1, 4096, GAB_TEMPLATE_DIMENSION]);

    for (let layer = 0; layer < ENCODER_LAYERS; layer += 1) {
      const prefix = `encoder.layers.${layer}`;
      const query = linear(tokens, `${prefix}.query`);
      const key = linear(tokens, `${prefix}.key`);
      const value = linear(tokens, `${prefix}.value`);

      let gab = linear(tokens, `${prefix}.gab_square`);
      gab = graph.reshape(gab, [itemCapacity, BOARD_TOKENS * GAB_SQUARE_DIMENSION]);
      gab = linear(gab, `${prefix}.gab_board`);
      gab = layerNorm(gelu(gab), `${prefix}.gab_board_norm`, GAB_INTERMEDIATE_DIMENSION);
      gab = linear(gab, `${prefix}.gab_heads`);
      gab = layerNorm(gelu(gab), `${prefix}.gab_heads_norm`, ATTENTION_HEADS * GAB_TEMPLATE_DIMENSION);
      gab = graph.reshape(gab, [itemCapacity, ATTENTION_HEADS, GAB_TEMPLATE_DIMENSION]);

      const contexts = [];
      for (let head = 0; head < ATTENTION_HEADS; head += 1) {
        const start = head * HEAD_DIMENSION;
        const q = graph.slice(query, [null, null, { start, length: HEAD_DIMENSION }]);
        const k = graph.slice(key, [null, null, { start, length: HEAD_DIMENSION }]);
        const v = graph.slice(value, [null, null, { start, length: HEAD_DIMENSION }]);
        const coefficient = graph.slice(gab, [null, { start: head, length: 1 }, null]);
        const gabFlat = graph.matmul(coefficient, sharedTemplatesBatch, { transposeB: true });
        const gabBias = graph.reshape(gabFlat, [itemCapacity, BOARD_TOKENS, BOARD_TOKENS]);
        let logits = graph.matmul(q, k, { transposeB: true });
        logits = divideBy(logits, 'attentionScale');
        logits = graph.binary('add', logits, gabBias);
        const attention = softmaxLast(logits);
        contexts.push(graph.matmul(attention, v));
      }

      const context = graph.concat(contexts, 2);
      const attentionOutput = linear(context, `${prefix}.attention_output`);
      const attentionResidual = graph.binary('add', tokens, attentionOutput);
      const normalizedAttention = layerNorm(attentionResidual, `${prefix}.attention_norm`, MODEL_WIDTH);
      let feedForward = linear(normalizedAttention, `${prefix}.feed_forward_input`);
      feedForward = gelu(feedForward);
      feedForward = linear(feedForward, `${prefix}.feed_forward_output`);
      const feedForwardResidual = graph.binary('add', normalizedAttention, feedForward);
      tokens = layerNorm(feedForwardResidual, `${prefix}.feed_forward_norm`, MODEL_WIDTH);
    }

    tokens = layerNorm(tokens, 'encoder.final_norm', MODEL_WIDTH);

    const source = linear(tokens, 'policy.source', false);
    const destination = linear(tokens, 'policy.destination', false);
    let basePolicy = graph.matmul(source, destination, { transposeB: true });
    basePolicy = divideBy(basePolicy, 'policyScale');
    const baseFlat = graph.reshape(basePolicy, [itemCapacity, 4096]);

    const promotionFromTokens = graph.gather(tokens, 1, PROMOTION_FROM);
    const promotionToTokens = graph.gather(tokens, 1, PROMOTION_TO);
    const promotionSource = linear(promotionFromTokens, 'policy.promotion_source');
    const promotionDestination = linear(promotionToTokens, 'policy.promotion_destination');
    const promotionHidden = gelu(graph.binary('add', promotionSource, promotionDestination));
    const promotionDeltas = linear(promotionHidden, 'policy.promotion_delta');
    const promotionBase = graph.gather(baseFlat, 1, PROMOTION_BASE);
    const promotionPieces = [];
    for (let piece = 0; piece < 3; piece += 1) {
      const delta3 = graph.slice(promotionDeltas, [null, null, { start: piece, length: 1 }]);
      const delta2 = graph.reshape(graph.contiguous(delta3), [itemCapacity, PROMOTION_FROM.length]);
      const logits2 = graph.binary('add', promotionBase, delta2);
      promotionPieces.push(graph.reshape(logits2, [itemCapacity, PROMOTION_FROM.length, 1]));
    }
    const promotionStack = graph.concat(promotionPieces, 2);
    const promotionFlat = graph.reshape(promotionStack, [itemCapacity, 66]);
    const policy = graph.concat([baseFlat, promotionFlat], 1);

    const pooledSum = graph.reduce('sum', tokens, { axes: [1] });
    const pooled = divideBy(pooledSum, 'width64');
    let scalar = layerNorm(pooled, 'value.pool_norm', MODEL_WIDTH);
    scalar = relu(linear(scalar, 'value.hidden'));
    scalar = graph.unary('tanh', linear(scalar, 'value.output'));

    return { policy, value: scalar };
  });

  const plan = TensorPlan.create(program);
  if (parameterLayout.byteLength !== LATTICEKNIGHT_PARAMETER_BYTES) {
    throw new Error(`Frozen checkpoint byte length mismatch: ${parameterLayout.byteLength}`);
  }
  if (program.outputs[0].spec.capacityShape[1] !== POLICY_WIDTH) {
    throw new Error('Frozen policy width diverged during TensorProgram construction.');
  }

  return Object.freeze({
    profile: LATTICEKNIGHT_FP32_PROGRAM_PROFILE,
    itemCapacity,
    parameterLayout,
    constantLayout,
    program,
    plan,
  });
}
