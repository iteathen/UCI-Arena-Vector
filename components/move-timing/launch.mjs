import fs from 'node:fs';
import path from 'node:path';

export function loadExperimentLaunch(args){
  if(args.length===0)return undefined;
  const keys=['--timing-experiment','--timing-experiment-sha256','--experiment-initial-time-ms','--experiment-transport-reserve-ms'],values={};
  if(args.length!==8)throw new Error('Explicit experiment requires all four declared arguments');
  for(let index=0;index<args.length;index+=2){const key=args[index],value=args[index+1];if(!keys.includes(key)||Object.hasOwn(values,key)||typeof value!=='string')throw new Error('Unsupported or repeated experiment launch argument');values[key]=value;}
  const file=values[keys[0]],sha256=values[keys[1]];
  if(!path.isAbsolute(file)||!sha256||!/^[a-f0-9]{64}$/.test(sha256))throw new Error('Experiment requires absolute artifact and SHA256');
  const numeric=(key,min,max)=>{const text=values[key];if(!/^\d+$/.test(text??''))throw new Error('Invalid experiment integer');const value=Number(text);if(!Number.isSafeInteger(value)||value<min||value>max)throw new Error('Experiment integer outside bounds');return value;};
  const initialTimeMs=numeric(keys[2],1,3600000),transportReserveMs=numeric(keys[3],0,60000);
  const before=fs.lstatSync(file);if(!before.isFile()||before.isSymbolicLink()||before.size>16384||before.size<2)throw new Error('Experiment file extent is outside bounds');
  const fd=fs.openSync(file,'r');let text;
  try{const admitted=fs.fstatSync(fd);if(!admitted.isFile()||admitted.dev!==before.dev||admitted.ino!==before.ino||admitted.size!==before.size)throw new Error('Experiment artifact changed during admission');const bytes=Buffer.alloc(admitted.size);let offset=0;while(offset<bytes.length){const read=fs.readSync(fd,bytes,offset,bytes.length-offset,offset);if(!read)throw new Error('Experiment file ended early');offset+=read;}const after=fs.fstatSync(fd);if(after.size!==admitted.size||after.mtimeMs!==admitted.mtimeMs||after.ctimeMs!==admitted.ctimeMs)throw new Error('Experiment artifact changed during read');text=bytes.toString('utf8');}finally{fs.closeSync(fd);}
  return Object.freeze({text,sha256,initialTimeMs,transportReserveMs});
}
