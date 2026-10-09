import path from 'node:path';
import {createHash} from 'node:crypto';
import selected from '../../contracts/root-tablebase-selection.json' with {type:'json'};
import {canonicalJson} from './tablebase.mjs';
import {readRootProviderDocument} from './tablebase-process.mjs';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const hex=/^[0-9a-f]{64}$/;
const closed=(v,keys)=>v&&Object.getPrototypeOf(v)===Object.prototype&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
export async function loadRootTablebaseBinding({file,selection=selected}){
 if(!closed(selection,['schema','componentId','version','manifestSha256','contractSha256'])||selection.schema!=='vector_root_tablebase_selection_v1'||selection.componentId!=='syzygy.root-provider'||selection.version!=='2.1.0'||!hex.test(selection.manifestSha256)||!hex.test(selection.contractSha256))throw new Error('Unsupported root provider selection');
 if(typeof file!=='string'||!path.isAbsolute(file))throw new Error('Absolute managed provider binding required');
 const bytes=await readRootProviderDocument(file,65536),binding=JSON.parse(bytes),selectionSha256=digest(canonicalJson(selection));
 const values=binding.schema==='vector_root_tablebase_binding_v2',digestKey=values?'canonicalSha256':'sha256';
 if(!closed(binding,['schema','selectionSha256','componentRoot','configuration'])||!['vector_root_tablebase_binding_v1','vector_root_tablebase_binding_v2'].includes(binding.schema)||binding.selectionSha256!==selectionSha256||typeof binding.componentRoot!=='string'||!path.isAbsolute(binding.componentRoot)||!closed(binding.configuration,['path',digestKey])||typeof binding.configuration.path!=='string'||!path.isAbsolute(binding.configuration.path)||!hex.test(binding.configuration[digestKey]))throw new Error('Managed provider binding or selection mismatch');
 const configBytes=await readRootProviderDocument(binding.configuration.path,65536),actual=values?digest(canonicalJson(JSON.parse(configBytes))):digest(configBytes);if(actual!==binding.configuration[digestKey])throw new Error('Managed provider configuration digest mismatch');
 return Object.freeze({root:binding.componentRoot,configPath:binding.configuration.path,...(values?{configurationIdentitySha256:actual}:{configSha256:actual}),manifestSha256:selection.manifestSha256,contractSha256:selection.contractSha256,bindingSha256:digest(bytes),selectionSha256});
}
