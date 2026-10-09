import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {admitBookBindingDocument,readBookBinding} from '../../components/root-knowledge/book-binding.mjs';
const document=()=>{const root=path.resolve('selected-book');return {schema:'vector_opening_book_binding_v1',schemaVersion:1,authorityMode:'immutable_pinned_snapshot',capability:'snapshot_v2',selection:{path:root,kind:'opening_book',source:'saved_locator',storageMode:'in_place_reference'},files:{bookFile:path.join(root,'strong_rare_v1.bin'),statsFile:path.join(root,'strong_rare_v1.stats'),policyFile:path.join(root,'strong_rare_v1.policy'),manifestFile:path.join(root,'snapshot.manifest.json')},pin:{manifestSha256:'a'.repeat(64)}};};
test('Book binding pins and closed fields never execute coercible or accessor metadata',()=>{
 let calls=0;const d=document();d.pin.manifestSha256={toString(){calls++;return 'a'.repeat(64);}};assert.throws(()=>admitBookBindingDocument(d),/BOOK_BINDING_INVALID/);assert.equal(calls,0);
 const getter=document();Object.defineProperty(getter,'pin',{get(){calls++;return null;},enumerable:true});assert.throws(()=>admitBookBindingDocument(getter),/BOOK_BINDING_INVALID/);assert.equal(calls,0);
 const symbolic=document();symbolic[Symbol('extra')]=true;assert.throws(()=>admitBookBindingDocument(symbolic),/BOOK_BINDING_INVALID/);
});
test('Book binding rejects undeclared files, escaped roles and incompatible authority',()=>{
 for(const mutate of [d=>{d.extra=true;},d=>{d.files.bookFile=path.resolve('other.bin');},d=>{d.pin=null;},d=>{d.authorityMode='service_managed_live_channel';d.selection.storageMode='managed_copy';d.pin=null;},d=>{d.capability='polyglot_base';},d=>{d.selection.kind='syzygy';}]){const d=document();mutate(d);assert.throws(()=>admitBookBindingDocument(d),/BOOK_BINDING_INVALID/);}
 const d=document(),admitted=admitBookBindingDocument(d);d.files.bookFile='changed';assert.notEqual(admitted.files.bookFile,'changed');assert(Object.isFrozen(admitted.files));
});
test('binding file reader admits exact bounded regular UTF8 document and rejects oversized malformed or linked inputs',async t=>{
 const parent=await fs.realpath(os.tmpdir()),dir=await fs.mkdtemp(path.join(parent,'vector-book-binding-')),incarnation=await fs.lstat(dir,{bigint:true});
 t.after(async()=>{const now=await fs.lstat(dir,{bigint:true});assert(now.isDirectory()&&!now.isSymbolicLink());assert.equal(await fs.realpath(dir),dir);assert.equal(path.dirname(dir),parent);assert(path.basename(dir).startsWith('vector-book-binding-'));for(const k of ['dev','ino','birthtimeNs'])assert.equal(now[k],incarnation[k]);await fs.rm(dir,{recursive:true});});
 const file=path.join(dir,'binding.json');await fs.writeFile(file,JSON.stringify(document()));assert.deepEqual(readBookBinding(file),document());
 await fs.writeFile(file,Buffer.alloc(65537,32));assert.throws(()=>readBookBinding(file),/BOOK_BINDING_INVALID/);
 await fs.writeFile(file,Buffer.from([0xff,0xff]));assert.throws(()=>readBookBinding(file));
 await fs.writeFile(file,JSON.stringify(document()));const link=path.join(dir,'linked');await fs.symlink(dir,link,process.platform==='win32'?'junction':'dir');assert.throws(()=>readBookBinding(path.join(link,'binding.json')),/BOOK_BINDING_INVALID/);
});

test('Windows UCI binding filename accepts absolute forward slashes while document roles stay canonical',{skip:process.platform!=='win32'},async t=>{
 const parent=await fs.realpath(os.tmpdir()),dir=await fs.mkdtemp(path.join(parent,'vector-book-binding-')),incarnation=await fs.lstat(dir,{bigint:true});
 t.after(async()=>{const now=await fs.lstat(dir,{bigint:true});assert(now.isDirectory()&&!now.isSymbolicLink());assert.equal(await fs.realpath(dir),dir);assert.equal(path.dirname(dir),parent);assert(path.basename(dir).startsWith('vector-book-binding-'));for(const k of ['dev','ino','birthtimeNs'])assert.equal(now[k],incarnation[k]);await fs.rm(dir,{recursive:true});});
 const file=path.join(dir,'binding.json'),doc=document();await fs.writeFile(file,JSON.stringify(doc));
 const input=file.replaceAll('\\','/');assert(path.isAbsolute(input));assert.notEqual(input,path.resolve(input));assert.deepEqual(readBookBinding(input),doc);
 for(const mutate of [d=>{d.selection.path=d.selection.path.replaceAll('\\','/');},d=>{d.files.bookFile=d.files.bookFile.replaceAll('\\','/');}]){const d=document();mutate(d);assert.throws(()=>admitBookBindingDocument(d),/BOOK_BINDING_INVALID/);}
 for(const input of ['binding.json',file+'\n',path.join(dir,'unused')+'\\..\\binding.json'])assert.throws(()=>readBookBinding(input),/BOOK_BINDING_INVALID/);
 const link=path.join(dir,'linked');await fs.symlink(dir,link,'junction');assert.throws(()=>readBookBinding(path.join(link,'binding.json').replaceAll('\\','/')),/BOOK_BINDING_INVALID/);
});
