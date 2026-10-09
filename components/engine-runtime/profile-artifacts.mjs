import fs from 'node:fs';
import {createHash} from 'node:crypto';
export const profileRepresentation='cuda-mcgs.search-ir/0.2.0';
export const profileVersion='0.1.0';
export const canonicalSource=source=>source.replace(/\r\n?/g,'\n').replace(/\n+$/g,'')+'\n';
export const sourceIdentity=source=>({algorithm:'sha256',sha256:createHash('sha256').update(canonicalSource(source)).digest('hex')});
export function selectedContract(authority,id){const c=authority.contractSet.contracts.find(c=>c.id===id);if(!c)throw new Error(`Selected public authority lacks ${id}`);return{kind:'catalog',id,specificationIdentity:c.specificationIdentity,sha256:c.sha256};}
export function profileReference(result){return{id:result.normalized.id,schema:{id:result.normalized.schema,version:'0.2.0',sha256:result.schemaSha},identity:{algorithm:result.identity.algorithm,sha256:result.identity.sha256}};}
export function withPublicSchema(result,name){const bytes=fs.readFileSync(new URL(import.meta.resolve(`cuda-mcgs/schemas/search-ir/0.2.0/${name}-profile.schema.json`)));return{...result,schemaSha:createHash('sha256').update(bytes.toString('utf8').replace(/\r\n?/g,'\n')).digest('hex')};}
export function semanticCatalog(owner,version){
  const artifacts=[],references=new Map();
  return{artifacts,define(name,definition,semantics){
    const id=`${owner}.${name}/${version}`,schema={$schema:'https://json-schema.org/draft/2020-12/schema',$id:id,...definition,'x-vector-semantics':semantics},bytes=new TextEncoder().encode(JSON.stringify(schema)+'\n'),reference={id,version,sha256:createHash('sha256').update(bytes).digest('hex')};
    if(references.has(name))throw new Error('Repeated product semantic schema');references.set(name,reference);artifacts.push({reference,bytes});return reference;
  },get(name){const r=references.get(name);if(!r)throw new Error(`Missing genuine product semantic schema ${name}`);return r;}};
}
export const finiteWorkBounds=()=>({maxWorkUnits:'4294967295',maxReads:'4294967295',maxWrites:'4294967295',maxRandomInputs:'0',cancellationObservationWorkUnits:'4294967295'});
