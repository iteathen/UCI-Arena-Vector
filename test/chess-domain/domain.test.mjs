import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
const require = createRequire(new URL('../../components/chess-domain/package.json', import.meta.url));
const { Chess } = require('chess.js');
const domain = await import('../../components/chess-domain/admission.mjs').catch(() => ({}));
const device = await import('../../components/chess-domain/device.mjs').catch(() => ({}));
const execution = await import('../../components/chess-domain/runtime.mjs').catch(() => ({}));
const physicalEvidence = {};
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

test('admits complete position fields and rejects malformed FEN and history exhaustion', () => {
  assert.equal(typeof domain.admitPosition, 'function', 'FEN admission API must exist');
  const admitted = domain.admitPosition(new Chess().fen());
  assert.equal(admitted.words.length, domain.STATE_WORDS);
  assert.equal(admitted.words[0], 4);
  assert.equal(admitted.words[4], 6);
  assert.equal(admitted.words[64], 0);
  assert.equal(admitted.words[65], 15);
  assert.equal(admitted.words[66], 64);
  assert.equal(admitted.words[67], 0);
  assert.equal(admitted.words[68], 1);
  assert.throws(() => domain.admitPosition('bad'), /FEN/);
  assert.throws(() => domain.admitPosition(new Chess().fen(), { history: Array(257).fill(new Chess().fen()) }), /history/);
});

test('restricted Device-JS Domain is admitted by the public compiler frontend', async () => {
  assert.equal(typeof device.buildDomainProgram, 'function', 'Device-JS Domain API must exist');
  const inspected = execution.inspectDomainProgram();
  assert.ok(inspected.deviceProgram);
});

test('physical device legality, transitions, terminals and history match independent chess.js', { skip: process.env.VECTOR_CHESS_NATIVE !== '1' }, async () => {
  assert.equal(typeof execution.qualifyDomain, 'function', 'physical public runtime Domain API must exist');
  const fens = [
    new Chess().fen(),
    'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
    '4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1',
    '4r1k1/8/8/8/8/8/8/R3K2R w KQ - 0 1',
    '5rk1/8/8/8/8/8/8/R3K2R w KQ - 0 1',
    'k7/8/8/4KPpr/8/8/8/8 w - g6 0 1',
    '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1',
    '4k3/P7/8/8/8/8/7p/4K3 w - - 0 1',
    '4k3/8/8/8/8/8/7p/4K3 b - - 0 1',
    '7k/6Q1/5K2/8/8/8/8/8 b - - 0 1',
    '7k/5K2/6Q1/8/8/8/8/8 b - - 0 1',
    '4k3/8/8/8/8/8/8/R3K3 w - - 100 60',
    '4k3/8/8/8/8/8/8/4K3 w - - 0 1',
    '4k3/8/8/8/8/8/8/2B1K3 w - - 0 1',
    '2b1k3/8/8/8/8/8/8/2B1K3 w - - 0 1',
    '1b2k3/8/8/8/8/8/8/2B1K3 w - - 0 1',
    'r3k2r/8/8/8/8/8/8/4K3 b kq - 0 1',
    '1r2k3/P7/8/8/8/8/8/4K3 w - - 0 1',
    '4k3/8/8/8/8/8/7p/4K1R1 b - - 0 1',
  ];
  const cases = fens.map((fen, i) => ({ id: `fixed-${i}`, fen, history: [fen], oracle: new Chess(fen) }));
  const played = new Chess();
  const history = [played.fen()];
  for (const move of ['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8']) {
    played.move({ from: move.slice(0, 2), to: move.slice(2, 4) });
    history.push(played.fen());
  }
  cases.push({ id: 'threefold', fen: played.fen(), history, oracle: played });
  // A deterministic independently generated game catches both-color transitions,
  // rights removal, captures and a wider position shape without production helpers.
  const random = new Chess();
  const randomHistory = [random.fen()];
  let seed = 9173;
  for (let ply = 0; ply < 32 && !random.isGameOver(); ply++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    random.move(random.moves()[seed % random.moves().length]);
    randomHistory.push(random.fen());
    if (ply % 4 === 3) cases.push({ id: `played-${ply}`, fen: random.fen(), history: [...randomHistory], oracle: new Chess(random.fen()) });
  }
  const result = await execution.qualifyDomain(cases.map(({ fen, history }) => domain.admitPosition(fen, { history })), { capacity: 256 });
  assert.equal(result.terminal.graceful, true);
  for (let i = 0; i < cases.length; i++) {
    const { id, fen, oracle } = cases[i];
    const row = result.results[i];
    assert.equal(row.status, 0, id);
    assert.equal(row.inCheck, oracle.isCheck(), id);
    const expected = oracle.moves({ verbose: true }).map(m => m.from + m.to + (m.promotion ?? '')).sort();
    assert.deepEqual(row.moves.map(m => domain.actionToUci(m.action)).sort(), expected, `${id} legal set`);
    const terminal = oracle.isCheckmate() ? 1 : oracle.isStalemate() ? 2 : oracle.isDrawByFiftyMoves() ? 3 : oracle.isThreefoldRepetition() ? 4 : oracle.isInsufficientMaterial() ? 5 : 0;
    assert.equal(row.terminal, terminal, `${id} terminal`);
    for (const move of row.moves) {
      const uci = domain.actionToUci(move.action);
      const child = new Chess(fen);
      child.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
      assert.equal(domain.stateToFen(move.state), child.fen(), `${id} ${uci} transition`);
      assert.equal(move.state[69], cases[i].history.length + 1, `${id} history append`);
    }
  }
  const pressure = await execution.qualifyDomain([domain.admitPosition(new Chess().fen())], { capacity: 1 });
  assert.equal(pressure.results[0].status, 2);
  assert.equal(pressure.results[0].moves.length, 0);
  assert.equal(pressure.terminal.graceful, true);
  physicalEvidence.domain = { cases: cases.length, transitions: result.results.reduce((n, r) => n + r.moves.length, 0), environment: result.environment, sourceIdentity: result.sourceIdentity, artifact: result.artifact, cleanup: result.terminal, inputs: cases.map(({ id, fen, history }, i) => ({ id, fen, historySha256: hash(JSON.stringify(history)), legalMoves: result.results[i].moves.map(m => domain.actionToUci(m.action)), transitions: result.results[i].moves.map(m => ({ action: domain.actionToUci(m.action), fen: domain.stateToFen(m.state) })) })), actionPressure: { capacity: 1, status: pressure.results[0].status, publishedChildren: pressure.results[0].moves.length, cleanup: pressure.terminal } };
  console.log(JSON.stringify({ domainPhysical: { cases: physicalEvidence.domain.cases, transitions: physicalEvidence.domain.transitions, node: result.environment.profile.node, device: result.environment.device.architecture, sourceIdentity: result.sourceIdentity, cleanup: result.terminal.graceful } }));
});

test('identity includes rule-50 and full repetition history, and equality verifies collisions', () => {
  assert.equal(typeof domain.equalState, 'function', 'state equality API must exist');
  const chess = new Chess();
  const first = domain.admitPosition(chess.fen());
  const second = domain.admitPosition(chess.fen().replace(' 0 1', ' 1 1'));
  assert.equal(domain.equalState(first.words, second.words), false);
  const longer = domain.admitPosition(chess.fen(), { history: [chess.fen(), chess.fen()] });
  assert.equal(domain.equalState(first.words, longer.words), false);
  assert.equal(domain.equalState(first.words, first.words.slice()), true);
});

test('physical Domain rejects corrupted state and declares finite history/clock pressure', { skip: process.env.VECTOR_CHESS_NATIVE !== '1' }, async () => {
  const initial = new Chess().fen();
  const corrupt = domain.admitPosition(initial); corrupt.words[0] = 13;
  const historyOverflow = domain.admitPosition(initial, { history: Array(256).fill(initial) });
  const clockOverflow = domain.admitPosition('4k3/8/8/8/8/8/8/R3K3 w - - 4294967294 1');
  clockOverflow.words[67] = 0xffffffff;
  const results = await execution.qualifyDomain([corrupt, historyOverflow, clockOverflow]);
  assert.equal(results.results[0].status, 1, 'invalid piece ids must fail before unchecked use');
  assert.equal(results.results[1].status, 3, 'full history must fail without publishing truncated children');
  assert.equal(results.results[2].status, 4, 'clock wrap must fail without publishing a child');
  assert.ok(results.results.every(row => row.moves.length === 0));
  assert.equal(results.terminal.graceful, true);
  physicalEvidence.pressure = { statuses: results.results.map(row => row.status), publishedChildren: results.results.map(row => row.moves.length), cleanup: results.terminal };
});

test('physical identity collision cannot authorize state reuse', { skip: process.env.VECTOR_CHESS_NATIVE !== '1' }, async () => {
  assert.equal(typeof execution.qualifyIdentity, 'function', 'physical identity equality capsule must exist');
  const left = domain.admitPosition(new Chess().fen());
  const right = domain.admitPosition(new Chess().fen());
  right.words[67] = 1;
  // Independently construct an exact FNV collision by reversing the odd prime.
  // Alter clock + move number; retain valid board, side and repetition records.
  const prime = 16777619n, modulus = 1n << 32n;
  let inverse = 1n;
  for (let i = 0; i < 5; i++) inverse = (inverse * (2n - prime * inverse)) & (modulus - 1n);
  const hash = words => { let h = 2166136261n; for (const w of words) h = ((h ^ BigInt(w)) * prime) & (modulus - 1n); return h; };
  const prefixLeft = hash(left.words.subarray(0, 69));
  const prefixRight = hash(right.words.subarray(0, 68));
  right.words[68] = Number(prefixRight ^ ((prefixLeft * inverse) & (modulus - 1n)));
  const result = await execution.qualifyIdentity(left, right);
  assert.equal(result.leftKey, result.rightKey, 'fixture must collide on the actual GPU key');
  assert.equal(result.equal, false, 'exact state verification must reject colliding different clocks');
  const same = await execution.qualifyIdentity(left, left);
  assert.equal(same.equal, true);
  assert.equal(result.terminal.graceful && same.terminal.graceful, true);
  physicalEvidence.identity = { collidedLeftKey: result.leftKey, collidedRightKey: result.rightKey, collidingEqual: result.equal, identicalEqual: same.equal, cleanup: [result.terminal, same.terminal] };
});

after(async () => {
  if (!process.env.VECTOR_CHESS_RECEIPT) return;
  assert.ok(physicalEvidence.domain && physicalEvidence.pressure && physicalEvidence.identity, 'receipt requires every physical acceptance gate');
  const sources = ['components/chess-domain/admission.mjs', 'components/chess-domain/device.mjs', 'components/chess-domain/runtime.mjs', 'components/chess-domain/package.json', 'components/chess-domain/package-lock.json', 'test/chess-domain/domain.test.mjs'];
  const identities = await Promise.all(sources.map(async file => ({ path: file, sha256: hash(await readFile(new URL(`../../${file}`, import.meta.url))) })));
  const receipt = { schema: 'vector.chess-domain-physical-qualification/1.0.0', status: 'pass', generatedAt: new Date().toISOString(), command: 'VECTOR_CHESS_NATIVE=1 node --experimental-ffi --test test/chess-domain/domain.test.mjs', node: { version: process.version, executableSha256: hash(await readFile(process.execPath)) }, cudaJs: { package: 'cuda-js@0.1.0-alpha.21', revision: '2bff226b752d3c0af8b9185274d411e5990008d4' }, oracle: { package: 'chess.js@1.4.0', independence: 'independent implementation; no production Domain expected-output path' }, sources: identities, gates: physicalEvidence, claimLimits: ['bounded orthodox chess Domain only', 'no MCGS graph/search/session, UCI, model, strength or release qualification', 'exact executed Windows/Node/CUDA/device identity only', 'native support projection remains library-owned'] };
  const destination = path.resolve(process.env.VECTOR_CHESS_RECEIPT);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
});
