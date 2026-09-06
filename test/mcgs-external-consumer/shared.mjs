import { createHash } from 'node:crypto';

export const VERSION = '0.1.0';
export const REPRESENTATION = 'cuda-mcgs.search-ir/0.2.0';
export const U128_MAX = '340282366920938463463374607431768211455';
export const U64_MAX = '18446744073709551615';
export const MCGS_REPOSITORY = 'iteathen/CUDA-MCGS';
export const CUDA_JS_REPOSITORY = 'iteathen/CUDA-JS';
export const CUDA_JS_REVISION = '45a9ef15537b52d6fd7c615b7e596676dfd00587';
export const CUDA_JS_PACKAGE = 'cuda-js@0.1.0-alpha.18';
export const PROFILE = 'vector-external-synthetic';

export function sha256(value) { return createHash('sha256').update(value, 'utf8').digest('hex'); }
export function canonicalSource(source) { return source.replace(/\r\n?/g, '\n').replace(/\n+$/g, '') + '\n'; }
export function sourceIdentity(source) { return { algorithm: 'sha256', sha256: sha256(canonicalSource(source)) }; }
export function contentIdentity(label) { return { algorithm: 'sha256', sha256: sha256(`vector-external:${label}`) }; }
export function schemaReference(id) { return { id: `${id}/${VERSION}`, version: VERSION, sha256: sha256(`vector-external:schema:${id}/${VERSION}`) }; }
export function catalogContract(authority, id) { const contract = authority.contractSet.contracts.find((entry) => entry.id === id); if (!contract) throw new Error(`accepted authority lacks ${id}`); return { kind: 'catalog', id, specificationIdentity: contract.specificationIdentity, sha256: contract.sha256 }; }
export function profileReference(result) { return { id: result.normalized.id, schema: { id: result.normalized.schema, version: '0.2.0', sha256: result.schemaSha }, identity: { algorithm: result.identity.algorithm, sha256: result.identity.sha256 } }; }
export function futureProfileReference(id, schemaId, schemaSha) { return { id, schema: { id: schemaId, version: '0.2.0', sha256: schemaSha }, identity: contentIdentity(`future-profile:${id}`) }; }
export function withSchema(result, schemaSha) { return { ...result, schemaSha }; }
export function workBounds(overrides = {}) { return { maxWorkUnits: overrides.maxWorkUnits ?? '32', maxReads: overrides.maxReads ?? '16', maxWrites: overrides.maxWrites ?? '16', maxRandomInputs: overrides.maxRandomInputs ?? '0', cancellationObservationWorkUnits: overrides.cancellationObservationWorkUnits ?? '8' }; }
