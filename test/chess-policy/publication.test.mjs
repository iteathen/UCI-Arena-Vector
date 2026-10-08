import assert from 'node:assert/strict';
import test from 'node:test';
async function api(){try{return await import('../../components/chess-policy/publication.mjs');}catch(e){if(e.code==='ERR_MODULE_NOT_FOUND')assert.fail('Policy atomic publication contribution is missing');throw e;}}
test('atomic publication declares bounded rows, exact quantization and authority envelope',async()=>{const {buildPolicyPublicationModule}=await api();const m=buildPolicyPublicationModule();assert.equal(m.profile.rowWords,6);assert.equal(m.profile.headerWords,8);assert.equal(m.profile.byteLength,6176);assert.equal(m.profile.quantization,1000000);assert.equal(m.profile.maximumReadAttempts,3);assert.deepEqual(m.functions.map(f=>f.name),['vEncodeSnapshotRow','vChooseEncoded']);});
