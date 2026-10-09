import { STATE_WORDS, HEADER_WORDS } from '../chess-domain/admission.mjs';
import { buildDomainDeviceModule } from '../chess-domain/device.mjs';
export const FEATURE_COUNT = 1088;
export const POLICY_COUNT = 4162;
export const ACTION_CAPACITY = 4096;

const source = `
function mSquare(square, side) {
  if (side === gpu.u32(1)) { return square ^ gpu.u32(7); }
  return square ^ gpu.u32(56);
}
function mWriteFeatures(state, base, stateCapacity, features, featureBase, featureCapacity) {
  if (base > stateCapacity || stateCapacity - base < gpu.u32(${STATE_WORDS}) || featureBase > featureCapacity || featureCapacity - featureBase < gpu.u32(1088)) { return gpu.u32(1); }
  let side = state[base + gpu.u32(64)]; let rights = state[base + gpu.u32(65)]; let ep = state[base + gpu.u32(70)];
  if (side > gpu.u32(1) || rights > gpu.u32(15) || ep > gpu.u32(64)) { return gpu.u32(2); }
  for (let q = gpu.u32(0); q < gpu.u32(64); q++) { if (state[base + q] > gpu.u32(12)) { return gpu.u32(2); } }
  for (let q = gpu.u32(0); q < gpu.u32(1088); q++) { features[featureBase + q] = gpu.f32(0); }
  for (let q = gpu.u32(0); q < gpu.u32(64); q++) {
    let piece = state[base + q]; if (piece === gpu.u32(0)) { continue; }
    if (side === gpu.u32(1)) { if (piece <= gpu.u32(6)) { piece = piece + gpu.u32(6); } else { piece = piece - gpu.u32(6); } }
    features[featureBase + (piece - gpu.u32(1)) * gpu.u32(64) + mSquare(q, side)] = gpu.f32(1);
  }
  if (side === gpu.u32(1)) { rights = ((rights & gpu.u32(3)) << gpu.u32(2)) | ((rights >> gpu.u32(2)) & gpu.u32(3)); }
  for (let bit = gpu.u32(0); bit < gpu.u32(4); bit++) {
    if ((rights & (gpu.u32(1) << bit)) !== gpu.u32(0)) {
      for (let q = gpu.u32(0); q < gpu.u32(64); q++) { features[featureBase + (gpu.u32(12) + bit) * gpu.u32(64) + q] = gpu.f32(1); }
    }
  }
  if (ep < gpu.u32(64)) { features[featureBase + gpu.u32(1024) + mSquare(ep, side)] = gpu.f32(1); }
  return gpu.u32(0);
}
function mPolicyIndex(state, base, stateCapacity, action) {
  if (base > stateCapacity || stateCapacity - base < gpu.u32(${STATE_WORDS}) || action >= gpu.u32(32768)) { return gpu.i32(-1); }
  let side = state[base + gpu.u32(64)]; if (side > gpu.u32(1)) { return gpu.i32(-1); }
  let from = mSquare(action & gpu.u32(63), side); let to = mSquare((action >> gpu.u32(6)) & gpu.u32(63), side); let promotion = (action >> gpu.u32(12)) & gpu.u32(7);
  if (promotion > gpu.u32(4)) { return gpu.i32(-1); }
  if (promotion === gpu.u32(0) || promotion === gpu.u32(4)) { return gpu.i32(from * gpu.u32(64) + to); }
  let sourceFile = from % gpu.u32(8); let targetFile = to % gpu.u32(8);
  if (from / gpu.u32(8) !== gpu.u32(1) || to / gpu.u32(8) !== gpu.u32(0) || gpu.i32(targetFile) - gpu.i32(sourceFile) < gpu.i32(-1) || gpu.i32(targetFile) - gpu.i32(sourceFile) > gpu.i32(1)) { return gpu.i32(-1); }
  let slot = gpu.u32(0);
  for (let file = gpu.u32(0); file < sourceFile; file++) {
    if (file === gpu.u32(0) || file === gpu.u32(7)) { slot = slot + gpu.u32(2); } else { slot = slot + gpu.u32(3); }
  }
  let firstTarget = gpu.u32(0); if (sourceFile !== gpu.u32(0)) { firstTarget = sourceFile - gpu.u32(1); }
  slot = slot + targetFile - firstTarget;
  return gpu.i32(gpu.u32(4096) + slot * gpu.u32(3) + promotion - gpu.u32(1));
}
`;
const p = (name, type) => ({ name, type });
export function buildModelInputDeviceModule() {
  return { source, functions: [
    { name: 'mSquare', kind: 'device', parameters: [p('square', 'u32'), p('side', 'u32')], returns: 'u32' },
    { name: 'mWriteFeatures', kind: 'device', parameters: [p('state', 'ptr<u32>'), p('base', 'u32'), p('stateCapacity', 'u32'), p('features', 'ptr<f32>'), p('featureBase', 'u32'), p('featureCapacity', 'u32')], returns: 'u32' },
    { name: 'mPolicyIndex', kind: 'device', parameters: [p('state', 'ptr<u32>'), p('base', 'u32'), p('stateCapacity', 'u32'), p('action', 'u32')], returns: 'i32' },
  ] };
}

export function buildModelInputProgram() {
  const domain = buildDomainDeviceModule();
  const model = buildModelInputDeviceModule();
  const kernel = `function modelInput(states, scratch, actions, actionCounts, features, policy, statuses, caseCount, featureCapacity) {
    let gid = gpu.thread.globalX(); if (gid >= caseCount) { return; }
    let base = gid * gpu.u32(${STATE_WORDS}); let sb = gid * gpu.u32(${HEADER_WORDS});
    let count = actionCounts[gid]; if (count > gpu.u32(${ACTION_CAPACITY})) { statuses[gid] = gpu.u32(2); return; }
    cNormalizeHistory(states, base, scratch, sb);
    statuses[gid] = mWriteFeatures(states, base, caseCount * gpu.u32(${STATE_WORDS}), features, gpu.u32(1) + gid * gpu.u32(1088), featureCapacity);
    for (let j = gpu.u32(0); j < count; j++) { let offset = gid * gpu.u32(${ACTION_CAPACITY}) + j; policy[offset] = mPolicyIndex(states, base, caseCount * gpu.u32(${STATE_WORDS}), actions[offset]); }
  }`;
  return { source: domain.source + model.source + kernel, functions: [...domain.functions, ...model.functions, { name: 'modelInput', kind: 'kernel', parameters: [p('states', 'ptr<u32>'), p('scratch', 'ptr<u32>'), p('actions', 'ptr<u32>'), p('actionCounts', 'ptr<u32>'), p('features', 'ptr<f32>'), p('policy', 'ptr<i32>'), p('statuses', 'ptr<u32>'), p('caseCount', 'u32'), p('featureCapacity', 'u32')], returns: 'void' }] };
}
