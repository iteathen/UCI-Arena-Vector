import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
export function canonicalJson(value) {
  const sort = (v) => Array.isArray(v) ? v.map(sort) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sort(v[k])])) : v;
  return JSON.stringify(sort(value));
}
function fail(message) { throw new Error(message); }
function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0); }
  return (c ^ 0xffffffff) >>> 0;
}

// This bounded parser accepts only the producer's uncompressed, single-disk ZIP profile.
// It never interprets pickle bytes or executes checkpoint content.
export function readStoredCheckpointZip(bytes) {
  const bounds = (offset, count, limit = bytes.length) => {
    if (!Number.isSafeInteger(offset) || offset < 0 || count < 0 || offset + count > limit) fail('ZIP bounds invalid');
  };
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (bytes.readUInt32LE(i) === 0x06054b50 && i + 22 + bytes.readUInt16LE(i + 20) === bytes.length) { end = i; break; }
  }
  if (end < 0) fail('ZIP end record missing or truncated');
  const count = bytes.readUInt16LE(end + 10), start = bytes.readUInt32LE(end + 16), size = bytes.readUInt32LE(end + 12);
  if (bytes.readUInt16LE(end + 4) || bytes.readUInt16LE(end + 6) || count !== bytes.readUInt16LE(end + 8) || count === 65535) fail('ZIP unsupported disk or ZIP64 profile');
  bounds(start, size, end);
  if (start + size !== end) fail('ZIP bounds central directory mismatch');
  const entries = new Map(), ranges = []; let offset = start;
  for (let index = 0; index < count; index++) {
    bounds(offset, 46, end);
    if (bytes.readUInt32LE(offset) !== 0x02014b50) fail('ZIP central header invalid');
    const flags = bytes.readUInt16LE(offset + 8), method = bytes.readUInt16LE(offset + 10), checksum = bytes.readUInt32LE(offset + 16);
    const compressed = bytes.readUInt32LE(offset + 20), uncompressed = bytes.readUInt32LE(offset + 24), n = bytes.readUInt16LE(offset + 28), x = bytes.readUInt16LE(offset + 30), c = bytes.readUInt16LE(offset + 32), local = bytes.readUInt32LE(offset + 42);
    if ((flags & ~0x808) || method !== 0 || compressed !== uncompressed || bytes.readUInt16LE(offset + 34)) fail('ZIP unsupported flags, compression, or disk');
    bounds(offset + 46, n + x + c, end);
    const nameBytes = bytes.subarray(offset + 46, offset + 46 + n), name = nameBytes.toString('utf8');
    if (!name || name.includes('..') || name.includes('\\') || name.startsWith('/') || name.includes('\0')) fail('ZIP entry name invalid');
    if (entries.has(name)) fail('ZIP duplicate entry');
    bounds(local, 30, start);
    if (bytes.readUInt32LE(local) !== 0x04034b50 || bytes.readUInt16LE(local + 6) !== flags || bytes.readUInt16LE(local + 8) !== method) fail('ZIP local header mismatch');
    const ln = bytes.readUInt16LE(local + 26), lx = bytes.readUInt16LE(local + 28), dataStart = local + 30 + ln + lx;
    bounds(local + 30, ln + lx, start); bounds(dataStart, compressed, start);
    if (!bytes.subarray(local + 30, local + 30 + ln).equals(nameBytes)) fail('ZIP local name header mismatch');
    if (!(flags & 8) && (bytes.readUInt32LE(local + 14) !== checksum || bytes.readUInt32LE(local + 18) !== compressed || bytes.readUInt32LE(local + 22) !== uncompressed)) fail('ZIP local size header mismatch');
    let rangeEnd = dataStart + compressed;
    if (flags & 8) {
      bounds(rangeEnd, 12, start);
      const signature = bytes.readUInt32LE(rangeEnd) === 0x08074b50 ? 4 : 0;
      bounds(rangeEnd, signature + 12, start);
      if (bytes.readUInt32LE(rangeEnd + signature) !== checksum || bytes.readUInt32LE(rangeEnd + signature + 4) !== compressed || bytes.readUInt32LE(rangeEnd + signature + 8) !== uncompressed) fail('ZIP data descriptor mismatch');
      rangeEnd += signature + 12;
    }
    if (ranges.some(([a, b]) => local < b && rangeEnd > a)) fail('ZIP overlapping entry ranges');
    ranges.push([local, rangeEnd]);
    const data = bytes.subarray(dataStart, dataStart + compressed);
    if (crc32(data) !== checksum) fail('ZIP CRC mismatch');
    entries.set(name, data); offset += 46 + n + x + c;
  }
  if (offset !== end) fail('ZIP central entry count mismatch');
  return entries;
}

export function extractCheckpointParameters({ checkpointBytes, descriptor, candidate }) {
  if (sha256(checkpointBytes) !== candidate.checkpointSha256) fail('Checkpoint identity mismatch');
  const layout = descriptor?.checkpoint_layout;
  if (layout?.schema !== candidate.layoutSchema || !layout.tensors || Array.isArray(layout.tensors)) fail('Descriptor layout identity mismatch');
  const tensors = Object.entries(layout.tensors).sort((a, b) => a[1].storage_index - b[1].storage_index);
  if (tensors.length !== candidate.tensorCount) fail('Descriptor tensor count mismatch');
  if (tensors.some(([, t], index) => t.storage_index !== index)) fail('Descriptor storage index sequence invalid');
  const entries = readStoredCheckpointZip(checkpointBytes), parts = [];
  for (let index = 0; index < tensors.length; index++) {
    const [name, t] = tensors[index];
    if (t.storage_index !== index) fail('Descriptor storage index sequence invalid');
    if (t.dtype !== 'float32' || !Array.isArray(t.shape) || !t.shape.length || t.shape.some((v) => !Number.isSafeInteger(v) || v < 1)) fail(`Descriptor tensor shape/dtype invalid: ${name}`);
    const expected = t.shape.reduce((a, b) => a * b, 4), data = entries.get(`${candidate.storagePrefix}/${index}`);
    if (!Number.isSafeInteger(expected) || !data || data.length !== expected) fail(`Tensor storage size mismatch: ${name}`);
    for (let i = 0; i < data.length; i += 4) if (!Number.isFinite(data.readFloatLE(i))) fail(`Nonfinite parameter: ${name}`);
    parts.push(data);
  }
  const parameters = Buffer.concat(parts);
  if (parameters.length !== candidate.parameterBytes || sha256(parameters) !== candidate.parameterSha256) fail('Flat parameter identity mismatch');
  return { parameters, identity: { ...candidate, qualificationStatus: 'candidate_parameters_materialized_tensor_parity_pending' } };
}

export function parseArguments(argv, names) {
  const result = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.slice(2);
    if (!argv[i]?.startsWith('--') || !names.includes(key) || result[key] || !argv[i + 1] || argv[i + 1].startsWith('--')) fail('Invalid or duplicate CLI argument');
    result[key] = argv[i + 1];
  }
  if (names.some((key) => !result[key])) fail(`Required arguments: ${names.map((k) => `--${k}`).join(' ')}`);
  return result;
}
export function assertNewEvidenceDirectory(directory, protectedPaths) {
  const resolved = path.resolve(directory);
  for (const source of protectedPaths) {
    const relative = path.relative(path.resolve(source), resolved);
    if (!relative || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) fail('Output must be outside protected producer/input roots');
  }
  if (fs.existsSync(resolved)) fail('Evidence output directory already exists');
  // Resolve existing parent links before writes, so a symlink cannot redirect outputs into inputs.
  let parent = path.dirname(resolved);
  while (!fs.existsSync(parent)) parent = path.dirname(parent);
  if (fs.realpathSync(parent).toLowerCase() !== parent.toLowerCase()) fail('Evidence output parent must not use symlinks');
  return resolved;
}

export function materializeSuccessor({ checkpoint, descriptor, onnx, adapter, package: packagePath, output }) {
  const candidate = JSON.parse(fs.readFileSync(new URL('../test/fixtures/model-successor/latticeknight-73091.json', import.meta.url)));
  const sources = { checkpoint: fs.readFileSync(checkpoint), descriptor: fs.readFileSync(descriptor), onnx: fs.readFileSync(onnx), adapter: fs.readFileSync(adapter) };
  for (const key of Object.keys(sources)) if (sha256(sources[key]) !== candidate[`${key}Sha256`]) fail(`${key} artifact identity mismatch`);
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  for (const [key, expected] of Object.entries(candidate.semanticContractSha256)) if (sha256(canonicalJson(pkg[key])) !== expected) fail(`Frozen architecture contract mismatch: ${key}`);
  const result = extractCheckpointParameters({ checkpointBytes: sources.checkpoint, descriptor: JSON.parse(sources.descriptor), candidate });
  const directory = assertNewEvidenceDirectory(output, [path.dirname(checkpoint), path.dirname(descriptor), path.dirname(onnx), path.dirname(adapter), path.dirname(path.dirname(packagePath))]);
  fs.mkdirSync(path.dirname(directory), { recursive: true }); fs.mkdirSync(directory);
  const write = (name, bytes) => fs.writeFileSync(path.join(directory, name), bytes, { flag: 'wx' });
  write('parameters.f32.bin', result.parameters); write('model.onnx', sources.onnx); write('feature-adapter.mjs', sources.adapter); write('descriptor.json', sources.descriptor);
  write('candidate.json', `${JSON.stringify({ ...result.identity, sourcePaths: { checkpoint, descriptor, onnx, adapter, package: packagePath }, descriptorFile: 'descriptor.json', adapterFile: 'feature-adapter.mjs', onnxFile: 'model.onnx', parameterFile: 'parameters.f32.bin', productNativeCodeUsed: false }, null, 2)}\n`);
  return { directory, ...result.identity };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(materializeSuccessor(parseArguments(process.argv.slice(2), ['checkpoint', 'descriptor', 'onnx', 'adapter', 'package', 'output'])), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
