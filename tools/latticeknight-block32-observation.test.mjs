import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import test from 'node:test';
async function api() { const url = new URL('./latticeknight-observation-checks.mjs', import.meta.url); try { await access(url); } catch { assert.fail('Block32 observation checks are missing'); } return import(url); }
test('guard verification rejects either boundary or an inactive item write', async () => { const { verifyGuardBytes } = await api(); const bytes = Buffer.alloc(64, 0xa5); bytes.writeFloatLE(1, 16); assert.equal(verifyGuardBytes(bytes, 32, 16), true); const before = Buffer.from(bytes); before[0] = 1; assert.throws(() => verifyGuardBytes(before, 32, 16), /guard/i); const after = Buffer.from(bytes); after[63] = 1; assert.throws(() => verifyGuardBytes(after, 32, 16), /guard/i); const inactive = Buffer.from(bytes); inactive[32] = 1; assert.throws(() => verifyGuardBytes(inactive, 32, 16), /inactive/i); });
test('guard verification rejects truncated buffers before accepting a no-write claim', async () => { const { verifyGuardBytes } = await api(); assert.throws(() => verifyGuardBytes(Buffer.alloc(63, 0xa5), 32), /length/i); });
test('model qualification separates historical and current exact cohorts and rejects mixed pairs', async () => {
  const { selectBlock32ModelCohort } = await api();
  const tensor = { package: { version: '0.1.0-alpha.10' }, cudaJs: { version: '0.1.0-alpha.22', protectedMainRevision: 'dc2924657bb900cdce3fba4c9def62934419db03' } };
  const cuda = { package: { version: '0.1.0-alpha.22' } };
  assert.equal(selectBlock32ModelCohort(tensor, cuda).tensorArtifactSha256, '219cb96e7f2723058bb17ef7ebc7bc6758a56c8b2dda5cb58cb9062575f1beaa');
  for (const changed of [{ ...tensor, package: { version: '0.1.0-alpha.9' } },
    { ...tensor, cudaJs: { ...tensor.cudaJs, version: '0.1.0-alpha.21' } },
    { ...tensor, cudaJs: { ...tensor.cudaJs, protectedMainRevision: '0'.repeat(40) } }]) {
    assert.throws(() => selectBlock32ModelCohort(changed, cuda), /cohort/);
  }
  assert.throws(() => selectBlock32ModelCohort(tensor, { package: { version: '0.1.0-alpha.21' } }), /cohort/);
});
