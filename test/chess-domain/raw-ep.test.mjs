import assert from 'node:assert/strict';
import test from 'node:test';
import { admitPosition, equalState, stateToFen } from '../../components/chess-domain/admission.mjs';
import { qualifyDomain, qualifyIdentity } from '../../components/chess-domain/runtime.mjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

test('physical double-push retains producer raw EP while repetition uses effective EP', { skip: process.env.VECTOR_CHESS_NATIVE !== '1' }, async () => {
  const initial = admitPosition('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const result = await qualifyDomain([initial]);
  const child = result.results[0].moves.find(({ action }) => action === (12 | (28 << 6))).state;
  assert.equal(child[66], 64, 'e2e4 cannot give black an EP capture in the initial position');
  assert.equal(child[70], 20, 'exact original raw target e3 must remain available to the producer feature adapter');
  assert.equal(stateToFen(child, { rawEnPassant: true }), 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1');
  const a = { format: initial.format, words: child };
  const b = { format: initial.format, words: child.slice() };
  b.words[70] = 64;
  assert.equal(equalState(a.words, b.words), false, 'feature-affecting raw EP is part of state identity');
  const identity = await qualifyIdentity(a, b);
  assert.equal(identity.equal, false);
  assert.notEqual(identity.leftKey, identity.rightKey);
  assert.equal(identity.terminal.graceful && result.terminal.graceful, true);
  if (process.env.VECTOR_RAW_EP_RECEIPT) {
    const hash = bytes => createHash('sha256').update(bytes).digest('hex');
    const files = ['components/chess-domain/admission.mjs', 'components/chess-domain/device.mjs', 'components/chess-domain/runtime.mjs', 'test/chess-domain/raw-ep.test.mjs'];
    const sources = await Promise.all(files.map(async file => ({ path: file, sha256: hash(await readFile(new URL(`../../${file}`, import.meta.url))) })));
    const receipt = { schema: 'vector.chess-domain-raw-ep-qualification/1.1.0', status: 'pass', generatedAt: new Date().toISOString(), node: { version: process.version, executableSha256: hash(await readFile(process.execPath)) }, sources, sourceIdentity: result.sourceIdentity, artifact: result.artifact, observed: { rawEp: child[70], effectiveEp: child[66], fen: stateToFen(child, { rawEnPassant: true }), differingRawEpEqual: identity.equal, differentKeys: [identity.leftKey, identity.rightKey] }, cleanup: [result.terminal, identity.terminal], historicalBase: '0d88591693ee3314033ad0f32d335998b2429f45' };
    const destination = path.resolve(process.env.VECTOR_RAW_EP_RECEIPT); await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  }
});
