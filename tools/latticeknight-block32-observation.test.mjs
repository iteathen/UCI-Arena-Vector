import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import test from 'node:test';
async function api() { const url = new URL('./latticeknight-block32-observation.mjs', import.meta.url); try { await access(url); } catch { assert.fail('Block32 model observation implementation is missing'); } return import(url); }
test('guard verification rejects either boundary or an inactive item write', async () => { const { verifyGuardBytes } = await api(); const bytes = Buffer.alloc(64, 0xa5); bytes.writeFloatLE(1, 16); assert.equal(verifyGuardBytes(bytes, 32, 16), true); const before = Buffer.from(bytes); before[0] = 1; assert.throws(() => verifyGuardBytes(before, 32, 16), /guard/i); const after = Buffer.from(bytes); after[63] = 1; assert.throws(() => verifyGuardBytes(after, 32, 16), /guard/i); const inactive = Buffer.from(bytes); inactive[32] = 1; assert.throws(() => verifyGuardBytes(inactive, 32, 16), /inactive/i); });
test('guard verification rejects truncated buffers before accepting a no-write claim', async () => { const { verifyGuardBytes } = await api(); assert.throws(() => verifyGuardBytes(Buffer.alloc(63, 0xa5), 32), /length/i); });
