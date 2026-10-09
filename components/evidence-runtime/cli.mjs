import { readFileSync, writeFileSync, renameSync, lstatSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { runEvidence, validateConfig } from './runtime.mjs';
import { validateLaunchArtifact, validateEngineIdentity } from './artifact.mjs';
import { UciSession } from './uci.mjs';

export async function executeRequest(request) {
  if(request?.schema!=='uci_arena_evidence_request_v2'||!['complete_game','paired_sprt','timing_profile'].includes(request.workload)
    ||['request_id','job_id','shard_id'].some(key=>typeof request[key]!=='string'||!request[key].length||request[key].length>256))throw new Error('invalid typed evidence request');
  const artifact=validateLaunchArtifact(request);
  const expected=artifact.expectedIdentity;
  validateEngineIdentity(expected,expected);
  if(expected.nodeVersion!==process.versions.node)throw new Error('runner Node version differs from exact artifact runtime');
  const admittedConfig=validateConfig(request.config);
  const sessions=new Set();let cancelled=false;
  const cancel=()=>{cancelled=true;for(const session of sessions){session.failure=new Error('evidence request cancelled');session.wake();session.process.kill();}};
  process.on('SIGINT',cancel);process.on('SIGTERM',cancel);
  const timer=setTimeout(cancel,admittedConfig.maxDurationMs);
  try {
    return await runEvidence(request,{openSession:async role=>{
      if(cancelled)throw new Error('evidence request cancelled');
      const options={...request.launch.uci_options,
        ...(role==='candidate'?request.config?.candidateOptions:request.config?.controlOptions)};
      const session=new UciSession(artifact.launch,options,{requireOwnerTeardown:true,role});sessions.add(session);
      const ready=session.ready.bind(session);
      session.ready=async()=>{const identity=await ready();validateEngineIdentity(identity,expected);return identity;};
      return session;
    }});
  }finally{
    await Promise.allSettled([...sessions].map(session=>session.close()));
    process.off('SIGINT',cancel);process.off('SIGTERM',cancel);
    clearTimeout(timer);
  }
}

function failureResult(request,error) {
  return {schema:'uci_arena_evidence_result_v2',request_id:request.request_id,job_id:request.job_id,shard_id:request.shard_id,
    workload:request.workload,target_identity:request.target_identity,runtime_identity:request.runtime_identity,
    status:'failed',completed:false,games:[],samples:[],engine_identities:[],failures:[String(error.message).slice(0,2048)],
    qualification:{diagnostic:true,timing:false,strength:false,profile_publication:false,reasons:['runtime_request_failed']}};
}
export async function main(args=process.argv.slice(2)) {
  if(args.length!==4||args[0]!=='--request'||args[2]!=='--output'||!path.isAbsolute(args[1])||!path.isAbsolute(args[3])||path.resolve(args[1])===path.resolve(args[3]))throw new Error('usage: --request <absolute JSON> --output <absolute JSON>');
  if(lstatSync(args[1]).isSymbolicLink()||!lstatSync(args[1]).isFile()||lstatSync(args[1]).size>1048576)throw new Error('request is not a bounded regular file');
  const request=JSON.parse(readFileSync(args[1],'utf8'));let result;
  try{result=await executeRequest(request);}catch(error){result=failureResult(request,error);}
  const temporary=`${args[3]}.${randomUUID()}.tmp`;writeFileSync(temporary,`${JSON.stringify(result,null,2)}\n`,{flag:'wx'});renameSync(temporary,args[3]);
  return result.status==='completed'?0:1;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  main().then(code=>{process.exitCode=code;},()=>{console.error('evidence runtime request rejected');process.exitCode=1;});
}
