import { PROFILE, REPRESENTATION, U128_MAX, VERSION, catalogContract, contentIdentity, profileReference, schemaReference, sourceIdentity } from './shared.mjs';

const OUTPUT_STATUS_CLASSES = {
  'invalid-output-profile': 'fatal', 'unsupported-output-schema': 'fatal', 'output-source-unavailable': 'pending',
  'output-source-stale': 'pending', 'output-capacity': 'pressure', 'output-terminal-capacity': 'fatal',
  'output-capture-inconsistent': 'fatal', 'output-payload-invalid': 'fatal', 'output-slot-stale': 'pending',
  'output-borrow-capacity': 'pressure', 'output-observation-dropped': 'drop', 'output-generation-exhausted': 'stop',
  'output-cancelled': 'cancellation', 'output-internal-failure': 'fatal',
};

const OUTPUT_ENVELOPE_FIELDS = ['search-identity', 'session-identity', 'search-incarnation', 'profile-identity', 'completion-class', 'first-stop-cause', 'completed-work', 'policy-budget-status', 'resource-status', 'diagnostic-identity'];
const OUTPUT_PUBLICATION_STATES = ['vacant', 'reserved', 'capturing', 'publishing', 'ready', 'released', 'retired', 'reusable'];
function outputBounds(overrides = {}) { return { maxBytes: overrides.maxBytes ?? '4096', maxElements: overrides.maxElements ?? '64', maxDepth: overrides.maxDepth ?? '8', maxReads: overrides.maxReads ?? '64', maxWrites: overrides.maxWrites ?? '64', maxWorkUnits: overrides.maxWorkUnits ?? '256', maxContinuations: overrides.maxContinuations ?? '8', cancellationObservationWorkUnits: overrides.cancellationObservationWorkUnits ?? '8', counterMaximum: U128_MAX }; }
function outputContributor(entry, progressPlan) {
  const work = progressPlan.workClasses.find(({ owner }) => owner === entry.id);
  return { id: entry.id, contract: entry.contract, profile: entry.profile, optional: entry.optional, sourceFacts: entry.publicTransitions.map((fact) => ({ fact, readiness: fact.sha256 === work.readiness.publication.sha256 ? 'ready' : 'terminal-ready' })), cleanup: schemaReference(`vector.mcgs-external.output-protection-${entry.id.replaceAll('.', '-')}`) };
}
function outputStatusList() { return Object.entries(OUTPUT_STATUS_CLASSES).map(([code, statusClass]) => ({ code, class: statusClass, diagnostic: true })); }
function outputPort(id) {
  const phases = { 'initialize-output-profile': 'host-preignition', 'classify-terminal-result': 'device-active', 'capture-terminal-payload': 'device-active', 'publish-output': 'device-active', 'fail-output': 'device-active', 'acquire-output': 'host-async', 'release-output': 'host-async', 'classify-output-reuse': 'device-active' };
  return { id, phase: phases[id], contract: schemaReference(`vector.mcgs-external.output-port-${id}`), bounds: outputBounds({ maxWorkUnits: id === 'capture-terminal-payload' ? '512' : '256' }), completion: id === 'capture-terminal-payload' ? 'finite-continuation' : (id === 'publish-output' ? 'must-complete' : 'bounded'), statuses: ['output-source-unavailable', 'output-source-stale', 'output-capacity', 'output-cancelled', 'output-internal-failure'], sourceMutation: 'prohibited' };
}

export function buildOutputInput(authority, vectorRevision, resourceResult, progressResult, source) {
  const resourcePlan = resourceResult.normalized;
  const progressPlan = progressResult.normalized;
  const contributors = progressPlan.contributors.map((entry) => outputContributor(entry, progressPlan));
  const terminalReserve = resourcePlan.reserves.find(({ purpose }) => purpose === 'terminal-result');
  const outputResourceOwner = resourcePlan.contributors.find(({ contract }) => contract.id === 'SPEC-0013');
  const outputProgressOwner = progressPlan.contributors.find(({ contract }) => contract.id === 'SPEC-0013');
  const terminalSchemaId = `output-schema.${PROFILE}.terminal`;
  const workingClass = resourcePlan.classes.find(({ id }) => id.endsWith('class-output-working'));
  const programInputs = [...new Map([...contributors.map(({ profile }) => profile), profileReference(resourceResult), profileReference(progressResult)].map((reference) => [reference.id, reference])).values()];
  const permission = schemaReference('vector.mcgs-external.output-permission');
  return {
    schema: 'cuda-mcgs.output-profile/0.2.0', representation: REPRESENTATION, status: 'accepted', contract: catalogContract(authority, 'SPEC-0013'), id: `output.${PROFILE}`, version: VERSION,
    resourcePlan: profileReference(resourceResult), progressPlan: profileReference(progressResult), resourceContribution: outputResourceOwner.profile, progressContribution: outputProgressOwner.profile,
    contributors,
    terminalEnvelope: { schema: schemaReference('vector.mcgs-external.terminal-envelope'), fields: OUTPUT_ENVELOPE_FIELDS, completionClasses: ['complete', 'valid-partial', 'no-valid-result', 'failed'], maxBytes: '4096', terminalReserve: terminalReserve.id, emptyPayloadValid: true, firstCauseImmutable: true },
    schemas: [{ id: terminalSchemaId, version: VERSION, kind: 'terminal', fieldOrder: [], maxBytes: '2048', maxElements: '64', maxDepth: '8', encoding: schemaReference('vector.mcgs-external.terminal-encoding'), usedLength: schemaReference('vector.mcgs-external.terminal-used-length'), serialization: { byteOrder: 'logical-little-endian', alignment: 'logical-alignment-independent', integrity: schemaReference('vector.mcgs-external.terminal-integrity'), invalidValues: schemaReference('vector.mcgs-external.terminal-invalid-values') }, consistency: 'terminal-quiescent', overflow: 'valid-partial', compatibility: contentIdentity('output-terminal-schema') }],
    fields: [],
    terminal: { schema: terminalSchemaId, cut: 'terminal-quiescent', sourceDisposition: 'ready-absent-failed-explicit', capture: outputBounds({ maxBytes: '2048', maxElements: '64', maxWorkUnits: '512', maxContinuations: '8' }), publication: 'exactly-once', immutability: true, borrow: schemaReference('vector.mcgs-external.terminal-borrow'), asyncRead: schemaReference('vector.mcgs-external.terminal-async-read'), sessionRequired: false, cleanup: schemaReference('vector.mcgs-external.terminal-cleanup') },
    observations: { kind: 'absent' },
    workspace: { resource: workingClass.id, scratchBytes: '32768', continuationBytes: '16384', diagnosticBytes: '32768', metadataBytes: '16384', maxBorrows: '16', maxTransfers: '64', counterMaximum: U128_MAX, counters: ['capturing', 'publishing', 'ready', 'borrowed', 'failed', 'released', 'high-water'], accounting: schemaReference('vector.mcgs-external.output-workspace-accounting'), generationExhaustion: 'restart-incarnation', hostSpill: 'none', cleanup: schemaReference('vector.mcgs-external.output-workspace-cleanup') },
    snapshot: { terminalCut: schemaReference('vector.mcgs-external.output-terminal-cut'), atomicCommit: null, versionRelation: null, independentVersions: null, rootEpoch: schemaReference('vector.mcgs-external.output-root-epoch'), sourceProtection: schemaReference('vector.mcgs-external.output-source-protection'), aggregation: schemaReference('vector.mcgs-external.output-aggregation'), sequenceValidation: schemaReference('vector.mcgs-external.output-sequence'), invalidation: schemaReference('vector.mcgs-external.output-invalidation') },
    publication: { states: OUTPUT_PUBLICATION_STATES, fullBeforeReady: true, releasePublication: schemaReference('vector.mcgs-external.output-release-publication'), acquireRead: schemaReference('vector.mcgs-external.output-acquire-read'), terminalConflict: 'quarantine', readyImmutable: true, borrow: schemaReference('vector.mcgs-external.output-publication-borrow'), maxBorrows: '16', maxTransfers: '64', borrowAcquire: schemaReference('vector.mcgs-external.output-borrow-acquire'), borrowRelease: schemaReference('vector.mcgs-external.output-borrow-release'), borrowExpiry: schemaReference('vector.mcgs-external.output-borrow-expiry'), waiterCompletion: schemaReference('vector.mcgs-external.output-waiter-completion'), hostDelivery: 'asynchronous-bounded-read', hostEffect: 'transfer-borrow-only', waiterBound: '16', mechanism: 'public-cuda-js-contract' },
    lifecycle: { states: ['profile-normalized', 'resources-admitted', 'initialized', 'active-or-terminal-capture', 'draining', 'terminal', 'released'], failure: schemaReference('vector.mcgs-external.output-lifecycle-failure'), quarantine: schemaReference('vector.mcgs-external.output-lifecycle-quarantine'), cancellation: schemaReference('vector.mcgs-external.output-lifecycle-cancellation'), rootDisposition: schemaReference('vector.mcgs-external.output-root-disposition'), workDisposition: schemaReference('vector.mcgs-external.output-work-disposition'), sessionDisposition: schemaReference('vector.mcgs-external.output-session-disposition'), reuse: schemaReference('vector.mcgs-external.output-reuse'), dispositions: ['terminal-slot', 'borrow', 'transfer'].map((id) => ({ id, root: id === 'terminal-slot' ? 'retain' : 'invalidate', session: id === 'terminal-slot' ? 'retain' : 'retire', release: schemaReference(`vector.mcgs-external.output-disposition-${id}`), retentionWorkUnits: '64' })), teardown: schemaReference('vector.mcgs-external.output-teardown'), release: schemaReference('vector.mcgs-external.output-release'), terminalOnlyElidesLive: true },
    ports: ['initialize-output-profile', 'classify-terminal-result', 'capture-terminal-payload', 'publish-output', 'fail-output', 'acquire-output', 'release-output', 'classify-output-reuse'].map(outputPort),
    statuses: outputStatusList(), permissions: [permission],
    consumerPolicy: { validation: schemaReference('vector.mcgs-external.output-consumer-validation'), serialization: schemaReference('vector.mcgs-external.output-consumer-serialization'), trust: schemaReference('vector.mcgs-external.output-consumer-trust'), provenance: schemaReference('vector.mcgs-external.output-consumer-provenance'), redaction: schemaReference('vector.mcgs-external.output-consumer-redaction'), permission, integrity: schemaReference('vector.mcgs-external.output-consumer-integrity') },
    diagnostics: { authority: 'non-authoritative', maxRecords: '16', maxBytes: '2048', overflow: 'count', rawAddresses: false, privatePayloads: false, deviceMemoryDump: false },
    compatibility: { packageIdentityRequired: true, nativeTransferIdentityOpaque: true, persistence: { kind: 'none' } },
    cleanup: { kinds: ['terminal-slot', 'terminal-payload', 'source-protection', 'borrow', 'transfer', 'diagnostic', 'program-artifact'], disposition: schemaReference('vector.mcgs-external.output-cleanup-disposition'), quarantine: schemaReference('vector.mcgs-external.output-cleanup-quarantine'), releaseOrder: schemaReference('vector.mcgs-external.output-cleanup-order'), retainedEvidence: schemaReference('vector.mcgs-external.output-cleanup-evidence') },
    programContribution: { kind: 'device-program', language: 'restricted-device-js', sourceIdentity: sourceIdentity(source), inputs: programInputs, provenance: { origin: 'first-party', revision: vectorRevision, license: 'GPL-3.0-or-later', review: schemaReference('vector.mcgs-external.output-program-review') } },
    productData: [],
  };
}
