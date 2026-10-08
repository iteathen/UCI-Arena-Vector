import { HEADER_WORDS, HISTORY_WORDS, STATE_WORDS, RESULT_WORDS } from './admission.mjs';

// This text is the maintained product algorithm. CUDA-JS owns all lowering,
// compilation, opaque artifacts and provider operations.
const deviceSource = `
function cAbs(x) { if (x < gpu.i32(0)) { return -x; } return x; }
function cColor(p) { if (p > gpu.u32(6)) { return gpu.u32(1); } return gpu.u32(0); }
function cType(p) { if (p > gpu.u32(6)) { return p - gpu.u32(6); } return p; }
function cStep(x) { if (x < gpu.i32(0)) { return gpu.i32(-1); } if (x > gpu.i32(0)) { return gpu.i32(1); } return gpu.i32(0); }
function cClear(s, base, from, to) {
  let fr = gpu.i32(from / gpu.u32(8)); let ff = gpu.i32(from % gpu.u32(8));
  let tr = gpu.i32(to / gpu.u32(8)); let tf = gpu.i32(to % gpu.u32(8));
  let dr = cStep(tr - fr); let df = cStep(tf - ff);
  let r = fr + dr; let f = ff + df;
  for (let n = gpu.u32(0); n < gpu.u32(7); n++) {
    if (r === tr && f === tf) { return true; }
    if (r < gpu.i32(0) || r >= gpu.i32(8) || f < gpu.i32(0) || f >= gpu.i32(8)) { return false; }
    if (s[base + gpu.u32(r * gpu.i32(8) + f)] !== gpu.u32(0)) { return false; }
    r = r + dr; f = f + df;
  }
  return false;
}
function cAttacked(s, base, square, by) {
  let tr = gpu.i32(square / gpu.u32(8)); let tf = gpu.i32(square % gpu.u32(8));
  for (let from = gpu.u32(0); from < gpu.u32(64); from++) {
    let p = s[base + from];
    if (p === gpu.u32(0) || cColor(p) !== by) { continue; }
    let type = cType(p); let dr = tr - gpu.i32(from / gpu.u32(8)); let df = tf - gpu.i32(from % gpu.u32(8));
    let ar = cAbs(dr); let af = cAbs(df);
    if (type === gpu.u32(1)) {
      let direction = gpu.i32(1); if (by === gpu.u32(1)) { direction = gpu.i32(-1); }
      if (dr === direction && af === gpu.i32(1)) { return true; }
    }
    if (type === gpu.u32(2) && ((ar === gpu.i32(2) && af === gpu.i32(1)) || (ar === gpu.i32(1) && af === gpu.i32(2)))) { return true; }
    if (type === gpu.u32(6) && ar <= gpu.i32(1) && af <= gpu.i32(1) && square !== from) { return true; }
    if ((type === gpu.u32(3) || type === gpu.u32(5)) && ar === af && ar !== gpu.i32(0) && cClear(s, base, from, square)) { return true; }
    if ((type === gpu.u32(4) || type === gpu.u32(5)) && ((dr === gpu.i32(0) && df !== gpu.i32(0)) || (df === gpu.i32(0) && dr !== gpu.i32(0))) && cClear(s, base, from, square)) { return true; }
  }
  return false;
}
function cKing(s, base, color) {
  let king = gpu.u32(6) + color * gpu.u32(6);
  for (let q = gpu.u32(0); q < gpu.u32(64); q++) { if (s[base + q] === king) { return q; } }
  return gpu.u32(64);
}
function cValidBoard(s, base) {
  if (s[base + gpu.u32(64)] > gpu.u32(1) || s[base + gpu.u32(65)] > gpu.u32(15) || s[base + gpu.u32(66)] > gpu.u32(64)) { return false; }
  let whiteKings = gpu.u32(0); let blackKings = gpu.u32(0);
  for (let q = gpu.u32(0); q < gpu.u32(64); q++) {
    let p = s[base + q]; if (p > gpu.u32(12)) { return false; }
    if (p === gpu.u32(6)) { whiteKings++; } if (p === gpu.u32(12)) { blackKings++; }
    if (cType(p) === gpu.u32(1) && (q < gpu.u32(8) || q >= gpu.u32(56))) { return false; }
  }
  if (whiteKings !== gpu.u32(1) || blackKings !== gpu.u32(1)) { return false; }
  let side = s[base + gpu.u32(64)]; let inactive = gpu.u32(1) - side;
  if (cAttacked(s, base, cKing(s, base, inactive), side)) { return false; }
  let ep = s[base + gpu.u32(66)];
  if (ep < gpu.u32(64)) {
    let rank = gpu.u32(5); let cap = ep - gpu.u32(8); let pawn = gpu.u32(7);
    if (side === gpu.u32(1)) { rank = gpu.u32(2); cap = ep + gpu.u32(8); pawn = gpu.u32(1); }
    if (ep / gpu.u32(8) !== rank || s[base + ep] !== gpu.u32(0) || s[base + cap] !== pawn) { return false; }
  }
  let rights = s[base + gpu.u32(65)];
  if ((rights & gpu.u32(3)) !== gpu.u32(0) && s[base + gpu.u32(4)] !== gpu.u32(6)) { return false; }
  if ((rights & gpu.u32(12)) !== gpu.u32(0) && s[base + gpu.u32(60)] !== gpu.u32(12)) { return false; }
  if ((rights & gpu.u32(1)) !== gpu.u32(0) && s[base + gpu.u32(7)] !== gpu.u32(4)) { return false; }
  if ((rights & gpu.u32(2)) !== gpu.u32(0) && s[base + gpu.u32(0)] !== gpu.u32(4)) { return false; }
  if ((rights & gpu.u32(4)) !== gpu.u32(0) && s[base + gpu.u32(63)] !== gpu.u32(10)) { return false; }
  if ((rights & gpu.u32(8)) !== gpu.u32(0) && s[base + gpu.u32(56)] !== gpu.u32(10)) { return false; }
  return true;
}
function cSimulate(s, base, d, db, from, to, promotion) {
  for (let j = gpu.u32(0); j < gpu.u32(67); j++) { d[db + j] = s[base + j]; }
  let p = s[base + from]; let color = cColor(p); let type = cType(p);
  d[db + from] = gpu.u32(0); d[db + to] = p;
  if (type === gpu.u32(1) && to === s[base + gpu.u32(66)] && s[base + to] === gpu.u32(0) && from % gpu.u32(8) !== to % gpu.u32(8)) {
    let captured = to - gpu.u32(8); if (color === gpu.u32(1)) { captured = to + gpu.u32(8); }
    d[db + captured] = gpu.u32(0);
  }
  if (promotion !== gpu.u32(0)) { d[db + to] = promotion + gpu.u32(1) + color * gpu.u32(6); }
  if (type === gpu.u32(6) && cAbs(gpu.i32(to) - gpu.i32(from)) === gpu.i32(2)) {
    let rookFrom = from + gpu.u32(3); let rookTo = from + gpu.u32(1);
    if (to < from) { rookFrom = from - gpu.u32(4); rookTo = from - gpu.u32(1); }
    d[db + rookTo] = d[db + rookFrom]; d[db + rookFrom] = gpu.u32(0);
  }
}
function cLegal(s, base, scratch, sb, from, to, promotion) {
  if (from >= gpu.u32(64) || to >= gpu.u32(64) || from === to || promotion > gpu.u32(4)) { return false; }
  let p = s[base + from]; let target = s[base + to]; let color = s[base + gpu.u32(64)];
  if (p === gpu.u32(0) || cColor(p) !== color || (target !== gpu.u32(0) && cColor(target) === color) || cType(target) === gpu.u32(6)) { return false; }
  let type = cType(p); let dr = gpu.i32(to / gpu.u32(8)) - gpu.i32(from / gpu.u32(8));
  let df = gpu.i32(to % gpu.u32(8)) - gpu.i32(from % gpu.u32(8)); let ar = cAbs(dr); let af = cAbs(df); let valid = false;
  if (type !== gpu.u32(1) && promotion !== gpu.u32(0)) { return false; }
  if (type === gpu.u32(1)) {
    let direction = gpu.i32(1); let startRank = gpu.u32(1); let lastRank = gpu.u32(7);
    if (color === gpu.u32(1)) { direction = gpu.i32(-1); startRank = gpu.u32(6); lastRank = gpu.u32(0); }
    if ((to / gpu.u32(8) === lastRank) !== (promotion !== gpu.u32(0))) { return false; }
    if (df === gpu.i32(0) && target === gpu.u32(0)) {
      if (dr === direction) { valid = true; }
      if (dr === direction * gpu.i32(2) && from / gpu.u32(8) === startRank && s[base + gpu.u32(gpu.i32(from) + direction * gpu.i32(8))] === gpu.u32(0)) { valid = true; }
    }
    if (af === gpu.i32(1) && dr === direction) {
      if (target !== gpu.u32(0)) { valid = true; }
      if (to === s[base + gpu.u32(66)] && target === gpu.u32(0)) {
        let captured = gpu.u32(gpu.i32(to) - direction * gpu.i32(8));
        if (s[base + captured] === gpu.u32(7) - color * gpu.u32(6)) { valid = true; }
      }
    }
  }
  if (type === gpu.u32(2)) { valid = (ar === gpu.i32(2) && af === gpu.i32(1)) || (ar === gpu.i32(1) && af === gpu.i32(2)); }
  if (type === gpu.u32(3)) { valid = ar === af && cClear(s, base, from, to); }
  if (type === gpu.u32(4)) { valid = (dr === gpu.i32(0) || df === gpu.i32(0)) && cClear(s, base, from, to); }
  if (type === gpu.u32(5)) { valid = (ar === af || dr === gpu.i32(0) || df === gpu.i32(0)) && cClear(s, base, from, to); }
  if (type === gpu.u32(6)) {
    valid = ar <= gpu.i32(1) && af <= gpu.i32(1);
    let home = gpu.u32(4) + color * gpu.u32(56);
    if (from === home && dr === gpu.i32(0) && af === gpu.i32(2) && target === gpu.u32(0)) {
      let mask = gpu.u32(1) << (color * gpu.u32(2)); let rook = home + gpu.u32(3); let transit = home + gpu.u32(1);
      if (df < gpu.i32(0)) { mask = mask << gpu.u32(1); rook = home - gpu.u32(4); transit = home - gpu.u32(1); }
      if ((s[base + gpu.u32(65)] & mask) !== gpu.u32(0) && s[base + rook] === gpu.u32(4) + color * gpu.u32(6) && cClear(s, base, from, rook) && !cAttacked(s, base, from, gpu.u32(1) - color)) {
        cSimulate(s, base, scratch, sb, from, transit, gpu.u32(0));
        if (!cAttacked(scratch, sb, transit, gpu.u32(1) - color)) { valid = true; }
      }
    }
  }
  if (!valid) { return false; }
  cSimulate(s, base, scratch, sb, from, to, promotion);
  let king = cKing(scratch, sb, color);
  if (king >= gpu.u32(64)) { return false; }
  return !cAttacked(scratch, sb, king, gpu.u32(1) - color);
}
function cEffectiveEp(s, base, scratch, sb) {
  let ep = s[base + gpu.u32(66)]; if (ep >= gpu.u32(64)) { return gpu.u32(64); }
  for (let q = gpu.u32(0); q < gpu.u32(64); q++) {
    if (cType(s[base + q]) === gpu.u32(1) && cLegal(s, base, scratch, sb, q, ep, gpu.u32(0))) { return ep; }
  }
  return gpu.u32(64);
}
function cNormalizeHistory(s, base, scratch, sb) {
  s[base + gpu.u32(66)] = s[base + gpu.u32(70)];
  s[base + gpu.u32(66)] = cEffectiveEp(s, base, scratch, sb);
  for (let n = gpu.u32(0); n < s[base + gpu.u32(69)]; n++) {
    let record = base + gpu.u32(${HEADER_WORDS}) + n * gpu.u32(${HISTORY_WORDS});
    s[record + gpu.u32(66)] = cEffectiveEp(s, record, scratch, sb);
  }
}
function cRepetitions(s, base) {
  let count = gpu.u32(0);
  for (let n = gpu.u32(0); n < s[base + gpu.u32(69)]; n++) {
    let record = base + gpu.u32(${HEADER_WORDS}) + n * gpu.u32(${HISTORY_WORDS}); let same = true;
    for (let j = gpu.u32(0); j < gpu.u32(${HISTORY_WORDS}); j++) { if (s[base + j] !== s[record + j]) { same = false; break; } }
    if (same) { count++; }
  }
  return count;
}
function cInsufficient(s, base) {
  let knights = gpu.u32(0); let bishops = gpu.u32(0); let bishopColor = gpu.u32(2); let sameBishops = true;
  for (let q = gpu.u32(0); q < gpu.u32(64); q++) {
    let type = cType(s[base + q]);
    if (type === gpu.u32(1) || type === gpu.u32(4) || type === gpu.u32(5)) { return false; }
    if (type === gpu.u32(2)) { knights++; }
    if (type === gpu.u32(3)) {
      bishops++; let color = (q / gpu.u32(8) + q % gpu.u32(8)) % gpu.u32(2);
      if (bishopColor === gpu.u32(2)) { bishopColor = color; } else if (bishopColor !== color) { sameBishops = false; }
    }
  }
  if (bishops + knights <= gpu.u32(1)) { return true; }
  return knights === gpu.u32(0) && sameBishops;
}
function cApply(s, base, d, db, scratch, sb, action) {
  let from = action & gpu.u32(63); let to = (action >> gpu.u32(6)) & gpu.u32(63); let promotion = (action >> gpu.u32(12)) & gpu.u32(7);
  if (action >= gpu.u32(32768) || !cLegal(s, base, scratch, sb, from, to, promotion)) { return gpu.u32(1); }
  let count = s[base + gpu.u32(69)]; if (count >= gpu.u32(256)) { return gpu.u32(3); }
  for (let j = gpu.u32(0); j < gpu.u32(${HEADER_WORDS}) + count * gpu.u32(${HISTORY_WORDS}); j++) { d[db + j] = s[base + j]; }
  cSimulate(s, base, d, db, from, to, promotion);
  let p = s[base + from]; let type = cType(p); let color = s[base + gpu.u32(64)]; let capture = s[base + to] !== gpu.u32(0);
  if (type === gpu.u32(1) && from % gpu.u32(8) !== to % gpu.u32(8)) { capture = true; }
  if ((type !== gpu.u32(1) && !capture && s[base + gpu.u32(67)] === gpu.u32(4294967295)) || (color === gpu.u32(1) && s[base + gpu.u32(68)] === gpu.u32(4294967295))) { return gpu.u32(4); }
  let rights = s[base + gpu.u32(65)];
  if (type === gpu.u32(6)) { rights = rights & ~(gpu.u32(3) << (color * gpu.u32(2))); }
  if (from === gpu.u32(0) || to === gpu.u32(0)) { rights = rights & gpu.u32(13); }
  if (from === gpu.u32(7) || to === gpu.u32(7)) { rights = rights & gpu.u32(14); }
  if (from === gpu.u32(56) || to === gpu.u32(56)) { rights = rights & gpu.u32(7); }
  if (from === gpu.u32(63) || to === gpu.u32(63)) { rights = rights & gpu.u32(11); }
  d[db + gpu.u32(64)] = gpu.u32(1) - color; d[db + gpu.u32(65)] = rights; d[db + gpu.u32(66)] = gpu.u32(64);
  if (type === gpu.u32(1) && cAbs(gpu.i32(to) - gpu.i32(from)) === gpu.i32(16)) { d[db + gpu.u32(66)] = (from + to) / gpu.u32(2); }
  d[db + gpu.u32(67)] = s[base + gpu.u32(67)] + gpu.u32(1);
  if (type === gpu.u32(1) || capture) { d[db + gpu.u32(67)] = gpu.u32(0); }
  d[db + gpu.u32(68)] = s[base + gpu.u32(68)] + color;
  d[db + gpu.u32(70)] = d[db + gpu.u32(66)];
  d[db + gpu.u32(66)] = cEffectiveEp(d, db, scratch, sb);
  let record = db + gpu.u32(${HEADER_WORDS}) + count * gpu.u32(${HISTORY_WORDS});
  for (let j = gpu.u32(0); j < gpu.u32(${HISTORY_WORDS}); j++) { d[record + j] = d[db + j]; }
  d[db + gpu.u32(69)] = count + gpu.u32(1);
  return gpu.u32(0);
}
function cIdentity(s, base) {
  let hash = gpu.u32(2166136261); let end = gpu.u32(${HEADER_WORDS}) + s[base + gpu.u32(69)] * gpu.u32(${HISTORY_WORDS});
  for (let j = gpu.u32(0); j < end; j++) { hash = (hash ^ s[base + j]) * gpu.u32(16777619); }
  return hash;
}
function cEqual(s, base, other, ob) {
  let count = s[base + gpu.u32(69)]; if (count !== other[ob + gpu.u32(69)] || count < gpu.u32(1) || count > gpu.u32(256)) { return false; }
  for (let j = gpu.u32(0); j < gpu.u32(${HEADER_WORDS}) + count * gpu.u32(${HISTORY_WORDS}); j++) { if (s[base + j] !== other[ob + j]) { return false; } }
  return true;
}
`;
const capsuleSource = `
function chessIdentity(left, right, output) {
  if (gpu.thread.globalX() !== gpu.u32(0)) { return; }
  output[gpu.u32(0)] = gpu.u32(1); output[gpu.u32(3)] = gpu.u32(0);
  if (left[gpu.u32(69)] < gpu.u32(1) || left[gpu.u32(69)] > gpu.u32(256) || right[gpu.u32(69)] < gpu.u32(1) || right[gpu.u32(69)] > gpu.u32(256)) { return; }
  output[gpu.u32(0)] = gpu.u32(0); output[gpu.u32(1)] = cIdentity(left, gpu.u32(0)); output[gpu.u32(2)] = cIdentity(right, gpu.u32(0));
  if (cEqual(left, gpu.u32(0), right, gpu.u32(0))) { output[gpu.u32(3)] = gpu.u32(1); }
}
function chessDomain(states, scratch, output, caseCount, capacity) {
  let gid = gpu.thread.globalX(); if (gid >= caseCount) { return; }
  let base = gid * gpu.u32(${STATE_WORDS}); let sb = gid * gpu.u32(${HEADER_WORDS}); let ob = gid * gpu.u32(${RESULT_WORDS});
  for (let j = gpu.u32(0); j < gpu.u32(8); j++) { output[ob + j] = gpu.u32(0); }
  let historyCount = states[base + gpu.u32(69)];
  if (capacity > gpu.u32(256) || historyCount < gpu.u32(1) || historyCount > gpu.u32(256)) { output[ob] = gpu.u32(1); return; }
  if (!cValidBoard(states, base) || states[base + gpu.u32(68)] === gpu.u32(0) || states[base + gpu.u32(70)] > gpu.u32(64)) { output[ob] = gpu.u32(1); return; }
  for (let j = gpu.u32(0); j < gpu.u32(67); j++) { scratch[sb + j] = states[base + j]; }
  scratch[sb + gpu.u32(66)] = states[base + gpu.u32(70)];
  if (!cValidBoard(scratch, sb)) { output[ob] = gpu.u32(1); return; }
  for (let n = gpu.u32(0); n < historyCount; n++) {
    if (!cValidBoard(states, base + gpu.u32(${HEADER_WORDS}) + n * gpu.u32(${HISTORY_WORDS}))) { output[ob] = gpu.u32(1); return; }
  }
  for (let j = gpu.u32(0); j < gpu.u32(${HISTORY_WORDS}); j++) {
    if (states[base + j] !== states[base + gpu.u32(${HEADER_WORDS}) + (historyCount - gpu.u32(1)) * gpu.u32(${HISTORY_WORDS}) + j]) { output[ob] = gpu.u32(1); return; }
  }
  cNormalizeHistory(states, base, scratch, sb);
  let color = states[base + gpu.u32(64)]; let king = cKing(states, base, color);
  if (king >= gpu.u32(64)) { output[ob] = gpu.u32(1); return; }
  let check = cAttacked(states, base, king, gpu.u32(1) - color);
  if (check) { output[ob + gpu.u32(2)] = gpu.u32(1); }
  output[ob + gpu.u32(4)] = cRepetitions(states, base);
  output[ob + gpu.u32(5)] = states[base + gpu.u32(67)];
  output[ob + gpu.u32(6)] = cIdentity(states, base);
  let count = gpu.u32(0);
  for (let from = gpu.u32(0); from < gpu.u32(64); from++) {
    let p = states[base + from]; if (p === gpu.u32(0) || cColor(p) !== color) { continue; }
    for (let to = gpu.u32(0); to < gpu.u32(64); to++) {
      let first = gpu.u32(0); let last = gpu.u32(0);
      if (cType(p) === gpu.u32(1) && (to / gpu.u32(8) === gpu.u32(0) || to / gpu.u32(8) === gpu.u32(7))) { first = gpu.u32(1); last = gpu.u32(4); }
      for (let promotion = first; promotion <= last; promotion++) {
        if (!cLegal(states, base, scratch, sb, from, to, promotion)) { continue; }
        if (count >= capacity) { output[ob] = gpu.u32(2); output[ob + gpu.u32(1)] = gpu.u32(0); return; }
        let slot = ob + gpu.u32(8) + count * gpu.u32(${STATE_WORDS + 1});
        let action = from | (to << gpu.u32(6)) | (promotion << gpu.u32(12));
        let status = cApply(states, base, output, slot + gpu.u32(1), scratch, sb, action);
        if (status !== gpu.u32(0)) { output[ob] = status; output[ob + gpu.u32(1)] = gpu.u32(0); return; }
        output[slot] = action; count++;
      }
    }
  }
  output[ob + gpu.u32(1)] = count;
  let terminal = gpu.u32(0);
  if (count === gpu.u32(0)) { terminal = gpu.u32(2); if (check) { terminal = gpu.u32(1); } }
  else if (states[base + gpu.u32(67)] >= gpu.u32(100)) { terminal = gpu.u32(3); }
  else if (output[ob + gpu.u32(4)] >= gpu.u32(3)) { terminal = gpu.u32(4); }
  else if (cInsufficient(states, base)) { terminal = gpu.u32(5); }
  output[ob + gpu.u32(3)] = terminal;
}
`;

const scalar = (name, type) => ({ name, type });
const pointer = name => scalar(name, 'ptr<u32>');
const fn = (name, parameters, returns) => ({ name, kind: 'device', parameters, returns });
export function buildDomainProgram() {
  const sb = [pointer('s'), scalar('base', 'u32')];
  const work = [...sb, pointer('scratch'), scalar('sb', 'u32')];
  return { source: deviceSource + capsuleSource, functions: [
    fn('cAbs', [scalar('x', 'i32')], 'i32'), fn('cColor', [scalar('p', 'u32')], 'u32'), fn('cType', [scalar('p', 'u32')], 'u32'), fn('cStep', [scalar('x', 'i32')], 'i32'),
    fn('cClear', [...sb, scalar('from', 'u32'), scalar('to', 'u32')], 'bool'),
    fn('cAttacked', [...sb, scalar('square', 'u32'), scalar('by', 'u32')], 'bool'), fn('cKing', [...sb, scalar('color', 'u32')], 'u32'), fn('cValidBoard', sb, 'bool'),
    fn('cSimulate', [...sb, pointer('d'), scalar('db', 'u32'), scalar('from', 'u32'), scalar('to', 'u32'), scalar('promotion', 'u32')], 'void'),
    fn('cLegal', [...work, scalar('from', 'u32'), scalar('to', 'u32'), scalar('promotion', 'u32')], 'bool'),
    fn('cEffectiveEp', work, 'u32'), fn('cNormalizeHistory', work, 'void'), fn('cRepetitions', sb, 'u32'), fn('cInsufficient', sb, 'bool'),
    fn('cApply', [...sb, pointer('d'), scalar('db', 'u32'), pointer('scratch'), scalar('sb', 'u32'), scalar('action', 'u32')], 'u32'),
    fn('cIdentity', sb, 'u32'), fn('cEqual', [...sb, pointer('other'), scalar('ob', 'u32')], 'bool'),
    { name: 'chessDomain', kind: 'kernel', parameters: [pointer('states'), pointer('scratch'), pointer('output'), scalar('caseCount', 'u32'), scalar('capacity', 'u32')], returns: 'void' },
    { name: 'chessIdentity', kind: 'kernel', parameters: [pointer('left'), pointer('right'), pointer('output')], returns: 'void' },
  ] };
}

// Public product contribution for downstream graph composition. It carries no
// qualification launch, scheduler, host transition or native implementation.
export function buildDomainDeviceModule() {
  return { source: deviceSource, functions: buildDomainProgram().functions.filter(({ kind }) => kind === 'device') };
}
