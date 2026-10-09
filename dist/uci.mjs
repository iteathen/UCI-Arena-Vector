import fs from 'node:fs';
import path from 'node:path';
import {createGameSearchPort} from '../components/engine-runtime/game-search-port.mjs';
import {runUciProcess} from '../components/uci-protocol/process.mjs';
const identityPath=path.resolve('contracts/runtime-identity.json');
const expected=fs.existsSync(identityPath)?JSON.parse(fs.readFileSync(identityPath,'utf8')):null;
const candidateRevision=process.env.VECTOR_CANDIDATE_SOURCE_REVISION;
const revision=expected?.vectorRevision??candidateRevision;
if(!/^[0-9a-f]{40}$/.test(revision??''))throw new Error('Inventoried runtime identity is required; qualification may explicitly supply candidate source revision');
if(expected&&expected.schema!=='vector_engine_runtime_identity_v1')throw new Error('Inventoried runtime identity schema mismatch');
const port=createGameSearchPort({revision,cacheDirectory:process.env.VECTOR_CANDIDATE_COMPILER_CACHE});
try{
 const onDiagnostic=process.env.VECTOR_CANDIDATE_CLOCK_DIAGNOSTICS==='1'?row=>process.stdout.write(`info string vector_clock_phase ${JSON.stringify(row)}\n`):undefined;
 const report=await runUciProcess({input:process.stdin,output:process.stdout,port,onDiagnostic});
 const encoded=JSON.stringify(report);if(encoded.length>32768)throw new Error('Owner teardown receipt exceeds bounded UCI extent');
 process.stdout.write(`info string vector_teardown ${encoded}\n`);
 process.stdin.destroy();
}catch(error){process.stderr.write(`Vector UCI failed: ${String(error?.message??error).replace(/[\x00-\x1f\x7f]/g,' ').slice(0,512)}\n`);process.exitCode=1;}
