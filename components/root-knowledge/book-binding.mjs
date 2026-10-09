import path from 'node:path';
import {openSync,closeSync,lstatSync,fstatSync,readSync} from 'node:fs';

export const BOOK_BINDING_SCHEMA='vector_opening_book_binding_v1';
const SHA=/^[0-9a-f]{64}$/u;
const fail=()=>{throw new Error('BOOK_BINDING_INVALID');};
const closed=(value,keys)=>{if(!value||typeof value!=='object'||Array.isArray(value)||Reflect.ownKeys(value).some(k=>typeof k!=='string')||Object.getOwnPropertyNames(value).sort().join(',')!==[...keys].sort().join(',')||Object.values(Object.getOwnPropertyDescriptors(value)).some(d=>!Object.hasOwn(d,'value')))fail();};
const filename=(value,empty=false)=>{if(empty&&value==='')return '';if(typeof value!=='string'||value.length>4096||/[\x00-\x1f\x7f]/u.test(value)||!path.isAbsolute(value)||path.resolve(value)!==value)fail();return value;};
export function admitBookBindingDocument(value){
 closed(value,['schema','schemaVersion','authorityMode','capability','selection','files','pin']);
 if(value.schema!==BOOK_BINDING_SCHEMA||value.schemaVersion!==1||!['immutable_pinned_snapshot','service_managed_live_channel'].includes(value.authorityMode)||!['snapshot_v2','polyglot_base'].includes(value.capability))fail();
 closed(value.selection,['path','kind','source','storageMode']);
 if(value.selection.kind!=='opening_book'||!['saved_locator','install_receipt'].includes(value.selection.source)||!['in_place_reference','managed_copy','external_path','installed_component'].includes(value.selection.storageMode))fail();
 filename(value.selection.path);closed(value.files,['bookFile','statsFile','policyFile','manifestFile']);
 filename(value.files.bookFile);for(const key of ['statsFile','policyFile','manifestFile'])filename(value.files[key],value.capability==='polyglot_base');
 if(value.capability==='polyglot_base'){
  if(value.authorityMode!=='immutable_pinned_snapshot'||value.files.bookFile!==value.selection.path||['statsFile','policyFile','manifestFile'].some(k=>value.files[k]!==''))fail();
  closed(value.pin,['bookSha256']);if(typeof value.pin.bookSha256!=='string'||!SHA.test(value.pin.bookSha256))fail();
 }else{
  const roles={bookFile:'strong_rare_v1.bin',statsFile:'strong_rare_v1.stats',policyFile:'strong_rare_v1.policy',manifestFile:'snapshot.manifest.json'};
  if(Object.entries(roles).some(([key,name])=>value.files[key]!==path.join(value.selection.path,name)))fail();
  if(value.authorityMode==='immutable_pinned_snapshot'){closed(value.pin,['manifestSha256']);if(typeof value.pin.manifestSha256!=='string'||!SHA.test(value.pin.manifestSha256))fail();}
  else if(value.pin!==null||value.selection.storageMode!=='in_place_reference')fail();
 }
 return Object.freeze({...value,selection:Object.freeze({...value.selection}),files:Object.freeze({...value.files}),pin:value.pin===null?null:Object.freeze({...value.pin})});
}
export function readBookBinding(filenameInput){
 const file=filename(process.platform==='win32'&&typeof filenameInput==='string'&&filenameInput.length<=4096?filenameInput.replaceAll('/','\\'):filenameInput);let cursor=path.parse(file).root;
 for(const part of file.slice(cursor.length).split(path.sep).filter(Boolean)){cursor=path.join(cursor,part);if(lstatSync(cursor).isSymbolicLink())fail();}
 const same=(a,b)=>a.dev===b.dev&&a.ino===b.ino&&a.size===b.size&&a.mtimeMs===b.mtimeMs&&a.ctimeMs===b.ctimeMs;
 const before=lstatSync(file);if(!before.isFile()||before.size<2||before.size>65536)fail();
 const fd=openSync(file,'r');try{const opened=fstatSync(fd);if(!same(before,opened))fail();const bytes=Buffer.alloc(opened.size);let at=0;while(at<bytes.length){const n=readSync(fd,bytes,at,bytes.length-at,at);if(!n)fail();at+=n;}if(!same(opened,fstatSync(fd))||!same(opened,lstatSync(file)))fail();return admitBookBindingDocument(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));}finally{closeSync(fd);}
}
