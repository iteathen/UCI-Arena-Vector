import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {openRootTablebaseProvider} from '../../components/root-knowledge/tablebase-process.mjs';
import selection from '../../contracts/root-tablebase-selection.json' with {type:'json'};

test('actual complete selected registry becomes ready after cancellable cold admission without relabeling warming',{skip:process.env.VECTOR_TB_READINESS_NATIVE!=='1'},async()=>{
 const configPath=process.env.VECTOR_TB_FULL_CONFIG,output=process.env.VECTOR_TB_READINESS_OBSERVATION;
 assert(configPath&&output&&process.env.VECTOR_TB_PACKAGE_ROOT);const config=JSON.parse(await fs.readFile(configPath));
 const started=performance.now(),provider=await openRootTablebaseProvider({root:process.env.VECTOR_TB_PACKAGE_ROOT,configPath,manifestSha256:selection.manifestSha256,contractSha256:selection.contractSha256}),first=provider.describe();let ready,close;
 try{assert.equal(first.status,'warming');assert.equal(Object.hasOwn(first.provider_identity,'dataset'),false);for(;;){ready=provider.describe();if(ready.status==='ready')break;if(performance.now()-started>180000)throw new Error('Complete registry readiness bound exceeded');await new Promise(r=>setTimeout(r,1000));}const dataset=ready.provider_identity.dataset;assert.equal(ready.provider_generation,first.provider_generation);assert.equal(dataset.manifest_sha256,config.manifest_sha256);assert.equal(dataset.file_count,config.selected_files.length);assert.deepEqual(dataset.files.map(row=>row.name).sort(),[...config.selected_files].sort());assert.equal(dataset.admitted_cardinality,6);close=await provider.close();assert.equal(close.provider.drained,true);assert.deepEqual(close.process,{code:0,signal:null,forced:false});}
 finally{await provider.close();}
 const record={schema:'vector_root_provider_registry_readiness_observation_v1',status:'pass',sourceRevision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),selection,first,ready,close,elapsedMilliseconds:performance.now()-started,scope:'exact-selected-registry-admission-only',rootProofRankingQualified:false,gpuRuntimeOpened:false,timingQualified:false};await fs.writeFile(output,JSON.stringify(record,null,2)+'\n',{flag:'wx'});
});
