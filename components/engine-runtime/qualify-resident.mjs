import fs from 'node:fs';
import {createGameSearchPort} from './game-search-port.mjs';
import {prepareChessBackend} from './gpu-backend.mjs';
import {START_POSITION} from '../uci-protocol/index.mjs';
// Explicit qualification entry, distinct from the product UCI process. No unit
// fixture can populate this physical observation record.
const [modelRoot,cacheDirectory,revision,output,phase='search']=process.argv.slice(2);
if(!modelRoot||!cacheDirectory||!/^[0-9a-f]{40}$/.test(revision??'')||!output||!['prepare','search'].includes(phase))throw new Error('Usage: qualify-resident.mjs MODELROOT CACHE SOURCE_REVISION NEW_OUTPUT [prepare|search]');
if(fs.existsSync(output))throw new Error('Physical observation destination already exists');
let backend;
const record={schema:'vector_resident_native_observation_v1',node:process.version,sourceRevision:revision,phase,status:'pending',startedAt:new Date().toISOString(),observations:[],searchQualified:false};
const port=createGameSearchPort({modelRoot,cacheDirectory,revision,prepare:async opts=>{backend=await prepareChessBackend(opts);record.preparation=backend.description;console.log('Actual canonical CUDA resident preparation passed');return backend;}});
try{
 record.identity=await port.ready();
 if(phase==='search'){
  const started=performance.now();record.admission=await port.admitPosition({fen:START_POSITION,moves:[],rootEpoch:1});console.log('Actual cold GPU root admitted; one continuation ignited');
  let id=0;
  while(performance.now()-started<15000){
   const before=await backend.prepared.status(),t=performance.now();await port.requestPublication({rootEpoch:1,requestId:++id});const snapshot=port.readPublication({rootEpoch:1,requestId:id});record.observations.push({elapsedMilliseconds:performance.now()-started,publicationMilliseconds:performance.now()-t,primaryBefore:before,snapshot});
   if(snapshot)console.log(JSON.stringify({action:snapshot.action,telemetry:snapshot.telemetry,primary:before.operation?.status}));
   if(snapshot?.telemetry?.completedGraphWorkAtRoot?.value>=3&&snapshot.telemetry.evaluatorReadyObserved.value>=3)break;
   await new Promise(resolve=>setTimeout(resolve,20));
  }
  if(!record.observations.some(o=>o.snapshot?.telemetry.completedGraphWorkAtRoot.value>=3&&o.snapshot.telemetry.evaluatorReadyObserved.value>=3))throw new Error('Actual repeated Graph/Evaluator progress not observed');
 }
 record.status='pass';
}catch(error){record.status='fail';record.failure={name:error.name,code:error.code,message:error.message,lower:error.lower,stack:error.stack};console.error(error);process.exitCode=1;}
finally{try{record.teardown=await port.close();}catch(error){record.status='fail';record.teardownFailure={name:error.name,code:error.code,message:error.message,stack:error.stack};console.error(error);process.exitCode=1;}record.finishedAt=new Date().toISOString();fs.writeFileSync(output,JSON.stringify(record,null,2)+'\n',{flag:'wx'});}
