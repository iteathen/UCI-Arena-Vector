import fs from 'node:fs';
import path from 'node:path';

// Cold admission only. The reader owns and closes the descriptor; publication
// never performs file I/O. Digest admission belongs to the policy consumer.
export function readTimingArtifact(file){
  if(typeof file!=='string'||!path.isAbsolute(file))throw new Error('Timing artifact requires an absolute path');
  const before=fs.lstatSync(file);
  if(!before.isFile()||before.isSymbolicLink()||before.size<2||before.size>16384)throw new Error('Timing artifact extent is outside bounds');
  const fd=fs.openSync(file,'r');
  try{
    const opened=fs.fstatSync(fd);
    const same=(a,b)=>a.dev===b.dev&&a.ino===b.ino&&a.size===b.size&&a.mtimeMs===b.mtimeMs&&a.ctimeMs===b.ctimeMs;
    if(!opened.isFile()||!same(before,opened))throw new Error('Timing artifact changed during admission');
    const bytes=Buffer.alloc(opened.size);let offset=0;
    while(offset<bytes.length){const n=fs.readSync(fd,bytes,offset,bytes.length-offset,offset);if(!n)throw new Error('Timing artifact ended early');offset+=n;}
    if(!same(opened,fs.fstatSync(fd))||!same(opened,fs.lstatSync(file)))throw new Error('Timing artifact changed during read');
    return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  }finally{fs.closeSync(fd);}
}
