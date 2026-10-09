import {createInterface} from 'node:readline';
import {createUciController} from './index.mjs';

export function runUciProcess({input,output,port,onDiagnostic}){
  if(typeof input?.on!=='function'||typeof output?.write!=='function')throw new Error('UCI transport requires input/output streams');
  const write=line=>output.write(line+'\n'),controller=createUciController({port,write,onDiagnostic}),lines=createInterface({input,terminal:false,crlfDelay:Infinity}),pending=new Set();
  let closing=false,transportFailure,resolve,reject;
  const done=new Promise((yes,no)=>{resolve=yes;reject=no;});
  const diagnostic=error=>write('info string error '+String(error?.message??error).replace(/[\x00-\x1f\x7f]/g,' ').slice(0,512));
  const finish=()=>{
    if(closing)return;closing=true;lines.close();
    Promise.resolve().then(async()=>{
      await Promise.allSettled([...pending]);
      const report=await controller.close();
      if(transportFailure)throw transportFailure;
      return report;
    }).then(resolve,reject);
  };
  lines.on('line',line=>{
    if(closing)return;
    if(pending.size>=64){transportFailure=new Error('UCI pending command capacity exhausted');finish();return;}
    const operation=controller.handle(line).catch(error=>{try{diagnostic(error);}catch(failure){transportFailure=failure;finish();}});
    pending.add(operation);operation.then(()=>pending.delete(operation),()=>pending.delete(operation));
    if(line.trim()==='quit')finish();
  });
  lines.once('close',finish);
  input.once('error',error=>{transportFailure=error;finish();});
  output.once('error',error=>{transportFailure=error;finish();});
  return done;
}
