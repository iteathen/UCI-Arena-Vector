import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
const module=await import('../../components/move-timing/launch.mjs').catch(()=>({}));
test('ordinary UCI launch has no experimental authority and incomplete flags fail closed',()=>{
  assert.equal(typeof module.loadExperimentLaunch,'function');assert.equal(module.loadExperimentLaunch([]),undefined);
  assert.throws(()=>module.loadExperimentLaunch(['--timing-experiment','relative.json']));
});
test('explicit experiment launch preserves exact bounded bytes and independently declared control',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'vector-timing-test-')),file=path.join(dir,'trial.json'),text='{"diagnostic":true}',sha=createHash('sha256').update(text).digest('hex');
  try{await fs.writeFile(file,text);const args=['--timing-experiment',file,'--timing-experiment-sha256',sha,'--experiment-initial-time-ms','180000','--experiment-transport-reserve-ms','50'];
    assert.deepEqual(module.loadExperimentLaunch(args),{text,sha256:sha,initialTimeMs:180000,transportReserveMs:50});
    assert.throws(()=>module.loadExperimentLaunch([...args,'--unknown','x']));
    await fs.writeFile(file,'x'.repeat(16385));assert.throws(()=>module.loadExperimentLaunch(args),/extent|bound/);
  }finally{await fs.rm(file,{force:true});await fs.rmdir(dir);}
});
