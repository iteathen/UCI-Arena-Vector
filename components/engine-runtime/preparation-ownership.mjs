const runtimeClean=runtime=>runtime?.graceful===true&&runtime.driver?.resourceCounts?.live===0&&runtime.driver?.resourceCounts?.orphaned===0;
export const preparedCleanupClean=cleanup=>cleanup?.status==='complete'&&Array.isArray(cleanup.failures)&&cleanup.failures.length===0&&runtimeClean(cleanup.runtime);
export function compilerCleanupReceipt(cleanup){return {owner:'model-compiler',cleanup:{status:runtimeClean(cleanup.runtime)&&(!cleanup.session||cleanup.session.graceful===true)?'complete':'failed',failures:[],...cleanup}};}
export function preparationFailure(error,state,receipts=[]){
 if(!['not-opened','retired','unknown','cleanup-failed'].includes(state))throw new Error('Invalid preparation ownership disposition');
 const failure=error instanceof Error?error:new Error(String(error));
 failure.preparationOwnership=Object.freeze({schema:'vector_backend_preparation_failure_v1',state,receipts:Object.freeze([...receipts])});
 return failure;
}
export async function finishPreparedInitialization(prepared,initialize,priorReceipts=[]){
 try{return await initialize();}catch(failure){
  let cleanup;
  try{cleanup=await prepared.close();}catch(error){throw preparationFailure(new AggregateError([failure,error],'Prepared admission and cleanup failed'),'cleanup-failed',priorReceipts);}
  throw preparationFailure(failure,preparedCleanupClean(cleanup)?'retired':'cleanup-failed',[...priorReceipts,{owner:'search-preparation',cleanup}]);
 }
}
export async function withCompilerLifetime({openRuntime,work}){
 let runtime;try{runtime=await openRuntime();}catch(error){throw preparationFailure(error,'unknown');}
 let session,value,failure;const cleanup={};
 try{value=await work(runtime,owned=>{if(session)throw new Error('Model compiler session owner already assigned');session=owned;});}catch(error){failure=error;}
 try{
  if(session){cleanup.session=await session.close();if(cleanup.session.graceful!==true)throw new Error('Model compiler session cleanup unproved; runtime retained');}
  cleanup.runtime=await runtime.close();if(!runtimeClean(cleanup.runtime))throw new Error('Model compiler runtime cleanup unproved');
 }catch(error){throw preparationFailure(new AggregateError([...(failure?[failure]:[]),error],'Public model compiler admission cleanup failed'),'cleanup-failed',[compilerCleanupReceipt(cleanup)]);}
 if(failure)throw preparationFailure(failure,'retired',[compilerCleanupReceipt(cleanup)]);
 return {value,cleanup};
}
