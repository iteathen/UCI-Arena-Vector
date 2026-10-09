import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access } from 'node:fs/promises';
import test from 'node:test';

const moduleUrl = new URL('./latticeknight-successor-candidate.mjs', import.meta.url);
async function api() {
  try { await access(moduleUrl); } catch { assert.fail('Successor extraction implementation is missing'); }
  return import(moduleUrl);
}
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
function crc(bytes) { let c = 0xffffffff; for (const b of bytes) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0); } return (c ^ 0xffffffff) >>> 0; }
function zip(entries) {
  const local = [], central = []; let offset = 0;
  for (const [name, bytes] of entries) {
    const n = Buffer.from(name), l = Buffer.alloc(30), c = Buffer.alloc(46);
    l.writeUInt32LE(0x04034b50); l.writeUInt16LE(20, 4); l.writeUInt32LE(crc(bytes), 14); l.writeUInt32LE(bytes.length, 18); l.writeUInt32LE(bytes.length, 22); l.writeUInt16LE(n.length, 26);
    c.writeUInt32LE(0x02014b50); c.writeUInt16LE(20, 6); c.writeUInt32LE(crc(bytes), 16); c.writeUInt32LE(bytes.length, 20); c.writeUInt32LE(bytes.length, 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(offset, 42);
    local.push(l, n, bytes); central.push(c, n); offset += 30 + n.length + bytes.length;
  }
  const end = Buffer.alloc(22), directory = Buffer.concat(central); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}
const floats = (...values) => { const b = Buffer.alloc(values.length * 4); values.forEach((v, i) => b.writeFloatLE(v, i * 4)); return b; };
function tiny() {
  const checkpointBytes = zip([['archive/data/1', floats(3)], ['archive/data/0', floats(1, 2)]]);
  const descriptor = { checkpoint_layout: { schema: 'test-layout', tensors: { second: { dtype: 'float32', shape: [1], storage_index: 1 }, first: { dtype: 'float32', shape: [2], storage_index: 0 } } } };
  const candidate = { checkpointSha256: sha(checkpointBytes), parameterSha256: sha(floats(1, 2, 3)), layoutSchema: 'test-layout', tensorCount: 2, parameterBytes: 12, storagePrefix: 'archive/data', runId: 'test-run', batch: 7 };
  return { checkpointBytes, descriptor, candidate };
}
test('extracts storage order independently of descriptor insertion and ZIP order', async () => { const { extractCheckpointParameters } = await api(); const out = extractCheckpointParameters(tiny()); assert.deepEqual([...out.parameters], [...floats(1, 2, 3)]); assert.equal(out.identity.batch, 7); });
test('rejects checkpoint identity mismatch', async () => { const { extractCheckpointParameters } = await api(); const input = tiny(); input.candidate.checkpointSha256 = '0'.repeat(64); assert.throws(() => extractCheckpointParameters(input), /checkpoint.*identity/i); });
test('rejects flat parameter identity mismatch', async () => { const { extractCheckpointParameters } = await api(); const input = tiny(); input.candidate.parameterSha256 = '0'.repeat(64); assert.throws(() => extractCheckpointParameters(input), /parameter.*identity/i); });
test('rejects repeated descriptor storage indices', async () => { const { extractCheckpointParameters } = await api(); const input = tiny(); input.descriptor.checkpoint_layout.tensors.second.storage_index = 0; assert.throws(() => extractCheckpointParameters(input), /storage.*index/i); });
test('rejects missing storage and wrong byte count', async () => { const { extractCheckpointParameters } = await api(); for (const [index, shape] of [[2, [1]], [1, [2]]]) { const input = tiny(); input.descriptor.checkpoint_layout.tensors.second = { dtype: 'float32', shape, storage_index: index }; assert.throws(() => extractCheckpointParameters(input), /storage|size/i); } });
test('rejects nonfinite parameter values', async () => { const { extractCheckpointParameters } = await api(); const input = tiny(); input.checkpointBytes = zip([['archive/data/0', floats(1, 2)], ['archive/data/1', floats(NaN)]]); input.candidate.checkpointSha256 = sha(input.checkpointBytes); assert.throws(() => extractCheckpointParameters(input), /nonfinite/i); });
test('rejects truncated ZIP and central directory bounds', async () => { const { readStoredCheckpointZip } = await api(); const input = tiny().checkpointBytes; assert.throws(() => readStoredCheckpointZip(input.subarray(0, input.length - 5)), /zip/i); const broken = Buffer.from(input); broken.writeUInt32LE(0xffffff00, broken.length - 6); assert.throws(() => readStoredCheckpointZip(broken), /zip.*bounds/i); });
test('rejects out of bounds local entry offsets', async () => { const { readStoredCheckpointZip } = await api(); const broken = tiny().checkpointBytes; const central = broken.readUInt32LE(broken.length - 6); broken.writeUInt32LE(broken.length + 1, central + 42); assert.throws(() => readStoredCheckpointZip(broken), /zip.*bounds/i); });
test('rejects duplicate ZIP storage names', async () => { const { readStoredCheckpointZip } = await api(); assert.throws(() => readStoredCheckpointZip(zip([['archive/data/0', floats(1)], ['archive/data/0', floats(2)]])), /duplicate/i); });
test('rejects compression and encrypted flags', async () => { const { readStoredCheckpointZip } = await api(); for (const [position, value] of [[10, 8], [8, 1]]) { const b = tiny().checkpointBytes; b.writeUInt16LE(value, b.readUInt32LE(b.length - 6) + position); assert.throws(() => readStoredCheckpointZip(b), /unsupported/i); } });
test('rejects corrupted data CRC and overlapping local ranges', async () => { const { readStoredCheckpointZip } = await api(); const a = tiny().checkpointBytes; a[30 + 'archive/data/1'.length] ^= 1; assert.throws(() => readStoredCheckpointZip(a), /crc/i); const b = tiny().checkpointBytes, c = b.readUInt32LE(b.length - 6), next = c + 46 + 'archive/data/1'.length; b.writeUInt32LE(0, next + 42); assert.throws(() => readStoredCheckpointZip(b), /overlap|header/i); });
