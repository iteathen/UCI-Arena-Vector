import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import {openRootTablebaseProvider} from '../../components/root-knowledge/tablebase-process.mjs';
import {captureNativeObservation,assertExternalObservation} from './native-observation.mjs';
import selection from '../../contracts/root-tablebase-selection.json' with {type:'json'};

test('actual external warming process admits a bounded handle and joins cold cancellation through its public contract',{skip:process.env.VECTOR_TB_WARMING_NATIVE!=='1'},async()=>{
 const root=process.env.VECTOR_TB_PACKAGE_ROOT,configPath=process.env.VECTOR_TB_FULL_CONFIG,output=process.env.VECTOR_TB_WARMING_OBSERVATION;
 assert(root&&configPath&&output,'Explicit qualification package/config/output required');
 const {bindingBytes:unusedBinding,...metadata}=await captureNativeObservation({selection,providerRoot:root,configPath});assert.equal(metadata.configuration.selectedFiles.length,1020,'Exact complete selected registry');assert.equal(new Set(metadata.configuration.selectedFiles).size,1020);
 const start=performance.now(),provider=await openRootTablebaseProvider({root,configPath,configurationIdentitySha256:metadata.configuration.canonicalSha256,manifestSha256:selection.manifestSha256,contractSha256:selection.contractSha256});
 const description=provider.describe(),admitMilliseconds=performance.now()-start;let close;
 try{assert.equal(description.status,'warming');assert.equal(description.provider_identity.configuration_sha256,metadata.configuration.canonicalSha256);assert.equal(description.readiness.dataset,'not-admitted');assert.equal(Object.hasOwn(description.provider_identity,'dataset'),false);assert.throws(()=>provider.probe({}),/warming/);close=await provider.close();assertExternalObservation(close,description.provider_generation);}
 finally{await provider.close();}
 const record={schema:'vector_root_provider_warming_consumer_observation_v1',status:'pass',...metadata,nodeVersion:process.versions.node,selection,description,close,admitMilliseconds,scope:'external-public-warming-cancellation-only',gpuRuntimeOpened:false,completeDatasetReadiness:false,engineCompositionQualification:false};
 await fs.writeFile(output,JSON.stringify(record,null,2)+'\n',{flag:'wx'});
});
