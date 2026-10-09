import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {canonicalJson} from '../../components/root-knowledge/tablebase.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
test('managed root provider binding resolves only a closed dependency selection and exact cold config bytes',async t=>{
 const {loadRootTablebaseBinding}=await import('../../components/root-knowledge/tablebase-binding.mjs');
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'vector-tb-binding-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const config=path.join(root,'dataset.json'),file=path.join(root,'binding.json');await fs.writeFile(config,'{}');
 const selection={schema:'vector_root_tablebase_selection_v1',componentId:'syzygy.root-provider',version:'2.1.0',manifestSha256:'a'.repeat(64),contractSha256:'b'.repeat(64)};
 const binding={schema:'vector_root_tablebase_binding_v1',selectionSha256:sha(canonicalJson(selection)),componentRoot:root,configuration:{path:config,sha256:sha('{}')}};
 await fs.writeFile(file,JSON.stringify(binding));const admitted=await loadRootTablebaseBinding({file,selection});assert.equal(admitted.root,root);assert.equal(admitted.configPath,config);assert.equal(admitted.manifestSha256,selection.manifestSha256);
 for(const bad of [{...binding,executable:'elsewhere.exe'},{...binding,selectionSha256:'c'.repeat(64)},{...binding,componentRoot:'relative'},{...binding,configuration:{...binding.configuration,sha256:'c'.repeat(64)}}]){await fs.writeFile(file,JSON.stringify(bad));await assert.rejects(loadRootTablebaseBinding({file,selection}),/binding|selection|configuration|absolute/i);}
});
