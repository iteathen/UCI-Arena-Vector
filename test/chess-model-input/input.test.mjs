import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { admitPosition } from '../../components/chess-domain/admission.mjs';
const component = await import('../../components/chess-model-input/runtime.mjs').catch(() => ({}));
const device = await import('../../components/chess-model-input/device.mjs').catch(() => ({}));
const producerPath = process.env.VECTOR_FEATURE_ORACLE ?? 'E:/uci-arena-task-builds/vector-model-parity-evidence-20261008/candidate-73091/feature-adapter.mjs';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const proof = {};
const producerSha256 = 'b217a6586d73854acd4a1d2e641c4bb7b879942eaa061219895afedc638e5632';
async function loadProducerOracle() {
  assert.equal(sha(await readFile(producerPath)), producerSha256, 'independent producer adapter must match the frozen snapshot before execution');
  return import(pathToFileURL(producerPath).href);
}

test('public Device-JS frontend admits model-input module and metadata', () => {
  assert.equal(typeof component.inspectModelInputProgram, 'function', 'model-input public frontend API must exist');
  assert.ok(component.inspectModelInputProgram().deviceProgram);
});

test('physical FP32 planes match immutable producer bytes with bounded writes', { skip: process.env.VECTOR_CHESS_NATIVE !== '1' }, async () => {
  assert.equal(typeof component.qualifyModelInputs, 'function', 'physical model input API must exist');
  const oracle = await loadProducerOracle();
  const fens = [
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1',
    'r3k2r/8/8/8/8/8/8/R3K2R w Kq - 0 1',
    'r3k2r/8/8/8/8/8/8/R3K2R b Kq - 0 1',
    '4k3/8/8/3pP3/8/8/8/4K3 w - d6 12 30',
    '4k3/8/8/8/3Pp3/8/8/4K3 b - d3 12 30',
    '1r2k3/P7/8/8/8/8/8/4K3 w - - 0 1',
    '4k3/8/8/8/8/8/7p/4K1R1 b - - 0 1',
    '4k3/8/8/8/8/8/8/4K3 w - - 0 1',
    '4k3/8/8/8/8/8/8/4K3 w - - 100 60',
  ];
  const rows = fens.map(fen => ({ state: admitPosition(fen), actions: [] }));
  rows.push({ state: admitPosition(fens[8], { history: Array(3).fill(fens[8]) }), actions: [] });
  const result = await component.qualifyModelInputs(rows);
  assert.equal(result.terminal.graceful, true);
  const comparisons = [];
  for (let i = 0; i < rows.length; i++) {
    const fen = fens[i] ?? fens[8];
    const expected = new Float32Array(oracle.materializeFen(fen, null, i === 10 ? 3 : 0).features);
    assert.equal(result.rows[i].status, 0);
    assert.deepEqual(new Uint8Array(result.rows[i].features.buffer), new Uint8Array(expected.buffer), `row ${i} exact f32 bytes`);
    comparisons.push({ fen, repetitionCount: i === 10 ? 3 : 0, expectedSha256: sha(new Uint8Array(expected.buffer)), observedSha256: sha(new Uint8Array(result.rows[i].features.buffer)) });
  }
  assert.deepEqual(result.rows[8].features, result.rows[9].features, 'rule-50 state must not acquire an invented model plane');
  assert.deepEqual(result.rows[8].features, result.rows[10].features, 'repetition state must remain Domain-owned and model-invisible');
  assert.equal(result.guardsIntact, true);
  const pressure = await component.qualifyModelInputs([rows[0]], { featureCapacity: 1087 });
  assert.equal(pressure.rows[0].status, 1);
  assert.equal(pressure.guardsIntact, true);
  assert.ok(pressure.rows[0].features.every(x => x === -7), 'capacity failure must not write any partial feature');
  proof.features = { comparisons, environment: result.environment, sourceIdentity: result.sourceIdentity, artifact: result.artifact, cleanup: result.terminal, guardsIntact: true, pressure: { status: pressure.rows[0].status, untouched: true, cleanup: pressure.terminal } };
});

test('physical action indices match every producer base/underpromotion slot in both orientations', { skip: process.env.VECTOR_CHESS_NATIVE !== '1' }, async () => {
  assert.equal(typeof component.qualifyModelInputs, 'function', 'physical policy mapping API must exist');
  const oracle = await loadProducerOracle();
  const white = '4k3/8/8/8/8/8/8/4K3 w - - 0 1';
  const black = white.replace(' w ', ' b ');
  const pack = (from, to, promotion = 0) => from | (to << 6) | (promotion << 12);
  const square = n => String.fromCharCode(97 + n % 8) + (Math.floor(n / 8) + 1);
  const baseActions = [];
  for (let from = 0; from < 64; from++) for (let to = 0; to < 64; to++) baseActions.push(pack(from, to));
  const under = [[], []];
  for (const entry of oracle.CONTRACT.policy.canonical_move_slots) for (let promotion = 1; promotion <= 4; promotion++) {
    const wf = entry.canonical_from_square ^ 56, wt = entry.canonical_to_square ^ 56;
    under[0].push(pack(wf, wt, promotion));
    under[1].push(pack(63 - wf, 63 - wt, promotion));
  }
  const cases = [
    { fen: white, actions: baseActions }, { fen: black, actions: baseActions },
    { fen: white, actions: under[0] }, { fen: black, actions: under[1] },
    { fen: white, actions: [pack(0, 8, 1), pack(0, 8, 2), pack(0, 8, 3), pack(0, 8, 5), 0x8000] },
  ];
  const result = await component.qualifyModelInputs(cases.map(({ fen, actions }) => ({ state: admitPosition(fen), actions })));
  const comparisons = [];
  for (let i = 0; i < 4; i++) {
    const expected = cases[i].actions.map(action => {
      const promotion = ['', 'n', 'b', 'r', 'q'][(action >>> 12) & 7];
      const move = square(action & 63) + square((action >>> 6) & 63) + promotion;
      return oracle.materializeFen(cases[i].fen, move).policy.index;
    });
    assert.deepEqual(result.rows[i].policyIndices, expected, `policy row ${i}`);
    comparisons.push({ side: i % 2 ? 'black' : 'white', count: expected.length, expectedSha256: sha(Buffer.from(new Int32Array(expected).buffer)), observedSha256: sha(Buffer.from(new Int32Array(result.rows[i].policyIndices).buffer)) });
  }
  assert.deepEqual(result.rows[4].policyIndices, [-1, -1, -1, -1, -1], 'invalid metadata/underpromotion geometry never indexes policy output');
  const actualUnder = result.rows[2].policyIndices.filter((_, i) => i % 4 !== 3).sort((a, b) => a - b);
  assert.deepEqual(actualUnder, Array.from({ length: 66 }, (_, i) => 4096 + i), 'every extension output is used once; no reserved tail');
  assert.equal(result.guardsIntact && result.terminal.graceful, true);
  proof.policy = { comparisons, baseMappings: 8192, promotionMappings: 176, invalidMappings: 5, cleanup: result.terminal, mappingTableSha256: oracle.CONTRACT.policy.mapping_table_sha256 };
});

test('physical features preserve original raw EP after device repetition normalization', { skip: process.env.VECTOR_CHESS_NATIVE !== '1' }, async () => {
  const oracle = await loadProducerOracle();
  const fens = [
    'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
    'k7/8/8/4KPpr/8/8/8/8 w - g6 0 1',
  ];
  const result = await component.qualifyModelInputs(fens.map(fen => ({ state: admitPosition(fen), actions: [] })));
  for (let i = 0; i < fens.length; i++) {
    const expected = new Float32Array(oracle.materializeFen(fens[i]).features);
    assert.deepEqual(new Uint8Array(result.rows[i].features.buffer), new Uint8Array(expected.buffer), `raw EP row ${i}: original FEN oracle must retain target plane`);
  }
  proof.rawEp = { cases: fens, byteParity: true, cleanup: result.terminal };
});

test('physical invalid model encoding rejects before any feature write', { skip: process.env.VECTOR_CHESS_NATIVE !== '1' }, async () => {
  const fen = '4k3/8/8/8/8/8/8/4K3 w - - 0 1';
  const rows = [[0, 13], [64, 2], [65, 16], [70, 65]].map(([index, bad]) => { const state = admitPosition(fen); state.words[index] = bad; return { state, actions: [] }; });
  const result = await component.qualifyModelInputs(rows);
  assert.deepEqual(result.rows.map(row => row.status), [2, 2, 2, 2]);
  assert.ok(result.rows.every(row => row.features.every(x => x === -7)), 'invalid encodings cannot publish partial features');
  assert.equal(result.guardsIntact && result.terminal.graceful, true);
  proof.invalid = { statuses: result.rows.map(row => row.status), untouched: true, guardsIntact: true, cleanup: result.terminal };
});

after(async () => {
  if (!process.env.VECTOR_MODEL_INPUT_RECEIPT) return;
  assert.ok(proof.features && proof.policy && proof.rawEp && proof.invalid, 'all physical gates required for receipt');
  const files = ['components/chess-domain/admission.mjs', 'components/chess-domain/device.mjs', 'components/chess-domain/runtime.mjs', 'components/chess-model-input/device.mjs', 'components/chess-model-input/runtime.mjs', 'components/chess-model-input/package.json', 'components/chess-model-input/package-lock.json', 'test/chess-model-input/input.test.mjs'];
  const sources = await Promise.all(files.map(async file => ({ path: file, sha256: sha(await readFile(new URL(`../../${file}`, import.meta.url))) })));
  const record = { schema: 'vector.model-input-physical-qualification/1.0.0', status: 'pass', generatedAt: new Date().toISOString(), node: { version: process.version, executableSha256: sha(await readFile(process.execPath)) }, producerAdapterSha256: producerSha256, producerContract: (await loadProducerOracle()).CONTRACT, cudaJsRevision: '2bff226b752d3c0af8b9185274d411e5990008d4', domainCommit: '8df38d887beae72b156ad69a4b9de77345e8e528', stateFormat: 'vector.chess-mailbox-u32/1.1.0', sources, gates: proof, claimLimits: ['feature/action adapter only; no NN, search, UCI or release claim', 'exact executed native profile only', 'omitted model state remains Domain-owned'] };
  const destination = path.resolve(process.env.VECTOR_MODEL_INPUT_RECEIPT);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
});
