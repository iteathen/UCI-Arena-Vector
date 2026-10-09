import {createHash} from 'node:crypto';
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const u32=value=>Number.isInteger(value)&&value>=0&&value<=0xfffffffe;
const failure=()=>{throw new Error('owner teardown receipt is absent, inconsistent or not quiescent');};
const identity=value=>Array.isArray(value)&&value.length===4&&value.every(word=>Number.isInteger(word)&&word>=0&&word<=0xffffffff)&&value.some(word=>word!==0)&&value.some(word=>word!==0xffffffff);
// Independent consumer checks on the published owner receipt. No engine imports,
// private state, GPU operations, or search-derived facts are produced here.
export function validateOwnerTeardown(value,{requireJoined=false}={}){
 let text;try{text=JSON.stringify(value);}catch{failure();}
 if(typeof text!=='string'||Buffer.byteLength(text)>32768||!plain(value)||value.schema!=='vector_engine_teardown_v1'||value.fixture===true||typeof value.joined!=='boolean')failure();
 const retained=value.gameTeardowns??[];if(!Array.isArray(retained)||retained.length>64)failure();
 if(value.closureJournal!==undefined){const j=value.closureJournal,hex=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
  if(!plain(j)||j.schema!=='vector_closure_journal_v1'||j.capacity!==8||j.scope!=='latest-proved-retirements-with-historical-disposition'||retained.length>j.capacity||['totalRetirements','totalJoined','evictedRetirements','evictedJoined'].some(key=>!u32(j[key]))||j.totalRetirements!==j.evictedRetirements+retained.length||j.totalJoined!==j.evictedJoined+retained.filter(r=>r?.joined===true).length||j.totalJoined>j.totalRetirements||j.evictedJoined>j.evictedRetirements||!hex(j.chainSha256))failure();
  const predecessor=j.retainedPredecessorSha256??(j.evictedRetirements===0?'0'.repeat(64):undefined);
  if(predecessor!==undefined){if(!hex(predecessor)||j.evictedRetirements===0&&predecessor!=='0'.repeat(64))failure();let hash=predecessor;for(const record of retained)hash=createHash('sha256').update(hash).update(JSON.stringify(record)).digest('hex');if(hash!==j.chainSha256)failure();}
 }
 if(value.noRuntimeOpened===true&&retained.length)failure();
 let joined=0;
 for(const receipt of [value,...retained]){
  if(!plain(receipt)||receipt.schema!=='vector_engine_teardown_v1'||receipt.fixture===true||typeof receipt.joined!=='boolean')failure();
  if(receipt===value&&receipt.noActiveRuntime===true&&receipt.cleanup===undefined){if(receipt.joined||receipt.semantic!==undefined||typeof receipt.noRuntimeOpened!=='boolean'||!receipt.noRuntimeOpened&&!retained.length)failure();continue;}
  if(receipt.noRuntimeOpened===true){if(receipt.joined||receipt.cleanup!==undefined||receipt.semantic!==undefined)failure();continue;}
  const cleanup=receipt.cleanup,driver=cleanup?.runtime?.driver?.resourceCounts;
  if(cleanup?.status!=='complete'||!Array.isArray(cleanup.failures)||cleanup.failures.length||cleanup.runtime?.graceful!==true||!plain(driver)||driver.live!==0||driver.orphaned!==0||!u32(driver.closed))failure();
  if(receipt.joined){joined++;const semantic=receipt.semantic,f=semantic?.fields;
   if(!u32(receipt.gameArena)||receipt.gameArena===0||semantic?.quiescent!==true||!plain(f)||['activePathOccurrences','activeWorkLease','backupPhase','pathProtections','evaluatorProtections','evaluatorRequestState','evaluatorBatchState'].some(key=>f[key]!==0))failure();
   if(['edgeLeaseClaims','edgeLeaseReleases','workLeaseClaims','workLeaseReleases','stopCause'].some(key=>!u32(f[key]))||f.edgeLeaseClaims!==f.edgeLeaseReleases||f.workLeaseClaims!==f.workLeaseReleases||f.stopCause===0||f.drainDisposition!==undefined&&f.drainDisposition!==0||!identity(semantic.acceptedCancel?.id)||!identity(semantic.acceptedCancel?.generation))failure();
  }
 }
 if(requireJoined&&joined===0)failure();
 return JSON.parse(text); // Retain owned bytes, never borrow the caller's object.
}
