import { PROFILE, REPRESENTATION, U128_MAX, U64_MAX, VERSION, catalogContract, contentIdentity, futureProfileReference, profileReference, schemaReference, sourceIdentity } from './shared.mjs';

const RESOURCE_STATUS_CLASSES = {
  'invalid-resource-profile': 'fatal', 'resource-capacity': 'pressure', 'resource-fragmentation': 'pressure',
  'resource-identifier-exhausted': 'stop', 'resource-generation-exhausted': 'stop', 'resource-counter-exhausted': 'stop',
  'resource-provider-failure': 'fatal', 'resource-pressure-high': 'pressure', 'resource-pressure-critical': 'pressure',
  'resource-cancelled': 'cancellation', 'resource-internal-failure': 'fatal',
};

function contributorProfileReference(result) { return profileReference(result); }
function knownContributor(result) {
  return {
    id: `owner.${result.normalized.id}`, contract: result.normalized.contract, profile: contributorProfileReference(result), optional: false,
    classes: result.normalized.resources.filter(({ maximum }) => maximum !== '0').map(({ id }) => `class.${id}`),
    responseContract: schemaReference(`vector.mcgs-external.resource-response-${result.normalized.id.replaceAll('.', '-')}`),
    cleanup: schemaReference(`vector.mcgs-external.resource-cleanup-${result.normalized.id.replaceAll('.', '-')}`),
  };
}
function futureContributor(authority, id, contractId, schemaId, schemaSha, classes, optional = false) {
  return { id: `owner.${id}`, contract: catalogContract(authority, contractId), profile: futureProfileReference(id, schemaId, schemaSha), optional, classes, responseContract: schemaReference(`vector.mcgs-external.resource-response-${id.replaceAll('.', '-')}`), cleanup: schemaReference(`vector.mcgs-external.resource-cleanup-${id.replaceAll('.', '-')}`) };
}
function lifetimeForScope(scope) { return scope === 'per-engine' ? 'engine' : (scope === 'per-worker' ? 'work' : 'transaction'); }
function classRange(maximumInstances) { return { identityMaximum: (BigInt(maximumInstances) + 1n).toString(), generationMaximum: U64_MAX, counterMaximum: U128_MAX, sentinelCount: '1', exhaustion: 'terminate-typed' }; }
function makeResourceClass(contributorId, source, options = {}) {
  const id = options.id ?? `class.${source.id}`;
  const maximum = options.maximum ?? source.maximum;
  const basis = options.basis ?? 'maximum-live';
  const single = basis === 'fixed' || basis === 'optional-reserve';
  const unitsPerInstance = single ? maximum : '1';
  const maximumInstances = single ? '1' : maximum;
  const scope = options.scope ?? source.scope;
  return {
    id, version: VERSION, contributor: contributorId, consumers: ['consumer.vector-external-program'], sourceResource: options.sourceResource ?? source.id,
    unit: options.unit ?? source.unit, minimumUnits: options.minimum ?? source.minimum,
    formula: { basis, unitsPerInstance, maximumInstances, maximumUnits: maximum }, alignment: options.alignment ?? source.alignment,
    memorySpaces: options.memorySpaces ?? source.memorySpaces ?? ['device-search'], access: options.access ?? ['read', 'write', 'atomic'],
    scope, lifetime: options.lifetime ?? lifetimeForScope(scope), admissionGroup: options.admissionGroup ?? `resource.${PROFILE}.admission-${id.replaceAll('.', '-')}`,
    accounting: schemaReference(`vector.mcgs-external.accounting-${id.replaceAll('.', '-')}`), watermark: `resource.${PROFILE}.watermark-${id.replaceAll('.', '-')}`,
    ownerPressureStatus: options.ownerPressureStatus ?? source.pressureOutcome ?? source.pressureStatus, exhaustion: 'capacity',
    cancellation: schemaReference(`vector.mcgs-external.cancellation-${id.replaceAll('.', '-')}`), cleanup: schemaReference(`vector.mcgs-external.cleanup-${id.replaceAll('.', '-')}`),
    compatibility: contentIdentity(`resource-class:${id}`), range: classRange(maximumInstances),
  };
}
function makePool(resourceClass, options = {}) {
  const id = options.id ?? `resource.${PROFILE}.pool-${resourceClass.id.replaceAll('.', '-')}`;
  return { id, unit: options.unit ?? resourceClass.unit, capacity: options.capacity ?? resourceClass.formula.maximumUnits, alignment: options.alignment ?? resourceClass.alignment, memorySpaces: options.memorySpaces ?? resourceClass.memorySpaces, access: options.access ?? resourceClass.access, lifetime: options.lifetime ?? (resourceClass.lifetime === 'transaction' ? 'work' : resourceClass.lifetime), fragmentation: schemaReference(`vector.mcgs-external.fragmentation-${id.replaceAll('.', '-')}`), largestGuaranteedRequest: options.largestGuaranteedRequest ?? (options.capacity ?? resourceClass.formula.maximumUnits), providerRequirement: `resource.${PROFILE}.provider-${id.replaceAll('.', '-')}`, cleanup: schemaReference(`vector.mcgs-external.pool-cleanup-${id.replaceAll('.', '-')}`) };
}
function makePartition(resourceClass, pool, offset = '0', capacity = null, cleanupOrder = '1') { return { id: `resource.${PROFILE}.partition-${resourceClass.id.replaceAll('.', '-')}`, pool: pool.id, class: resourceClass.id, offset, capacity: capacity ?? resourceClass.formula.maximumUnits, alignment: resourceClass.alignment, alias: { kind: 'none' }, cleanupOrder }; }
function makeAdmissionGroup(resourceClasses, id, compound = false) {
  return { id, classes: resourceClasses.map(({ id: classId }) => classId), globalOrder: resourceClasses.map(({ id: classId }) => classId), atomicity: compound ? 'all-or-none-transaction' : 'single-cas', rollback: schemaReference(`vector.mcgs-external.rollback-${id.replaceAll('.', '-')}`), maxTransactions: compound ? '8' : '128', provisionalLimits: resourceClasses.map((entry) => ({ class: entry.id, maximumUnits: entry.formula.maximumUnits })), completion: schemaReference(`vector.mcgs-external.completion-${id.replaceAll('.', '-')}`), cancellation: schemaReference(`vector.mcgs-external.admission-cancel-${id.replaceAll('.', '-')}`) };
}
function makeLedger(resourceClass) {
  return { class: resourceClass.id, states: ['claimed', 'published', 'retired-unreclaimed', 'quarantined'], conservation: 'capacity-conserved-v1', leaseIdentity: schemaReference(`vector.mcgs-external.lease-${resourceClass.id.replaceAll('.', '-')}`), publication: schemaReference(`vector.mcgs-external.ledger-publication-${resourceClass.id.replaceAll('.', '-')}`), counterMaximum: resourceClass.range.counterMaximum, highWater: schemaReference(`vector.mcgs-external.high-water-${resourceClass.id.replaceAll('.', '-')}`), failedAdmissions: schemaReference(`vector.mcgs-external.failed-admissions-${resourceClass.id.replaceAll('.', '-')}`), releases: schemaReference(`vector.mcgs-external.releases-${resourceClass.id.replaceAll('.', '-')}`), terminalDispositions: ['released', 'retired-unreclaimed', 'quarantined', 'owner-equivalent'] };
}
function makeWatermark(resourceClass, progressReserve) {
  const max = BigInt(resourceClass.formula.maximumUnits);
  return { id: resourceClass.watermark, class: resourceClass.id, measured: 'claimed', comparison: 'used-at-least', normalUpTo: (max / 4n).toString(), highAt: (max / 2n).toString(), criticalAt: ((max * 3n) / 4n).toString(), exhaustedAt: max.toString(), hysteresis: schemaReference(`vector.mcgs-external.hysteresis-${resourceClass.id.replaceAll('.', '-')}`), publication: schemaReference(`vector.mcgs-external.pressure-${resourceClass.id.replaceAll('.', '-')}`), responses: ['high', 'critical', 'exhausted'].map((state, index) => ({ state, owner: resourceClass.contributor, response: schemaReference(`vector.mcgs-external.pressure-response-${state}-${resourceClass.id.replaceAll('.', '-')}`), maxWorkUnits: String(16 * (index + 1)), reserve: progressReserve })) };
}
function makeProvider(pool) { return { id: pool.providerRequirement, pool: pool.id, unit: pool.unit, capacity: pool.capacity, alignment: pool.alignment, memorySpaces: pool.memorySpaces, access: pool.access, lifecycle: schemaReference(`vector.mcgs-external.provider-lifecycle-${pool.id.replaceAll('.', '-')}`), opaqueResult: contentIdentity(`provider:${pool.id}`) }; }
function resourcePort(id) {
  const pre = ['normalize-contribution', 'compose-resource-plan', 'admit-engine-resources'].includes(id);
  return { id, phase: pre ? 'host-preignition' : (id === 'terminate-resource-profile' ? 'host-postterminal' : 'device-active'), contract: schemaReference(`vector.mcgs-external.resource-port-${id}`), bounds: { maxWorkUnits: id === 'reserve-compound' ? '64' : '32', maxReads: '32', maxWrites: '16', maxRandomInputs: '0', cancellationObservationWorkUnits: '8' }, completion: id === 'reserve-compound' ? 'finite-transaction' : (id === 'terminate-resource-profile' ? 'must-drain' : 'bounded'), statuses: ['resource-capacity', 'resource-cancelled', 'resource-internal-failure'] };
}

export function buildResourceInput(authority, vectorRevision, domainResult, graphResult, policyResult, schemaShas, source) {
  const domainOwner = knownContributor(domainResult);
  const graphOwner = knownContributor(graphResult);
  const policyOwner = knownContributor(policyResult);
  const terminalClassId = `resource.${PROFILE}.class-terminal-envelope`;
  const workingClassId = `resource.${PROFILE}.class-output-working`;
  const progressClassId = `resource.${PROFILE}.class-progress-cleanup`;
  const ledgerClassId = `resource.${PROFILE}.class-ledgers`;
  const outputOwner = futureContributor(authority, `output.${PROFILE}`, 'SPEC-0013', 'cuda-mcgs.output-profile/0.2.0', schemaShas.output, [terminalClassId, workingClassId]);
  const progressOwner = futureContributor(authority, `progress.${PROFILE}`, 'SPEC-0012', 'cuda-mcgs.progress-profile/0.2.0', schemaShas.progress, [progressClassId]);
  const resourceOwner = futureContributor(authority, `resource.${PROFILE}.core`, 'SPEC-0011', 'cuda-mcgs.resource-profile/0.2.0', schemaShas.resource, [ledgerClassId]);
  const contributors = [domainOwner, graphOwner, policyOwner, outputOwner, progressOwner, resourceOwner];
  const classes = [];
  for (const [owner, result] of [[domainOwner, domainResult], [graphOwner, graphResult], [policyOwner, policyResult]]) {
    for (const resource of result.normalized.resources.filter(({ maximum }) => maximum !== '0')) classes.push(makeResourceClass(owner.id, resource, { id: `class.${resource.id}` }));
  }
  const coreAdmission = `resource.${PROFILE}.admission-core`;
  const terminalClass = makeResourceClass(outputOwner.id, { id: terminalClassId, unit: 'bytes', minimum: '4096', maximum: '4096', alignment: '256', scope: 'per-engine', pressureStatus: 'output-terminal-capacity' }, { id: terminalClassId, sourceResource: terminalClassId, basis: 'fixed', admissionGroup: coreAdmission, memorySpaces: ['device-publication'], access: ['read', 'write', 'publish'], ownerPressureStatus: 'output-terminal-capacity' });
  const workingClass = makeResourceClass(outputOwner.id, { id: workingClassId, unit: 'bytes', minimum: '0', maximum: '131072', alignment: '256', scope: 'per-engine', pressureStatus: 'output-capacity' }, { id: workingClassId, sourceResource: workingClassId, memorySpaces: ['device-search', 'device-publication'], access: ['read', 'write', 'atomic', 'publish'], ownerPressureStatus: 'output-capacity' });
  const progressClass = makeResourceClass(progressOwner.id, { id: progressClassId, unit: 'bytes', minimum: '8192', maximum: '8192', alignment: '256', scope: 'per-engine', pressureStatus: 'progress-cleanup-capacity' }, { id: progressClassId, sourceResource: progressClassId, basis: 'optional-reserve', admissionGroup: coreAdmission, ownerPressureStatus: 'progress-cleanup-capacity' });
  const ledgerClass = makeResourceClass(resourceOwner.id, { id: ledgerClassId, unit: 'records', minimum: '64', maximum: '1024', alignment: '8', scope: 'per-engine', pressureStatus: 'resource-capacity' }, { id: ledgerClassId, sourceResource: ledgerClassId, ownerPressureStatus: 'resource-capacity' });
  classes.push(terminalClass, workingClass, progressClass, ledgerClass);
  const corePool = { id: `resource.${PROFILE}.pool-core`, unit: 'bytes', capacity: '12288', alignment: '256', memorySpaces: ['device-search', 'device-publication'], access: ['read', 'write', 'atomic', 'publish'], lifetime: 'engine', fragmentation: schemaReference('vector.mcgs-external.core-fragmentation'), largestGuaranteedRequest: '8192', providerRequirement: `resource.${PROFILE}.provider-core`, cleanup: schemaReference('vector.mcgs-external.core-pool-cleanup') };
  const pools = [corePool];
  const partitions = [makePartition(terminalClass, corePool, '0', '4096', '1'), makePartition(progressClass, corePool, '4096', '8192', '2')];
  let cleanupOrder = 3;
  for (const entry of classes.filter(({ id }) => ![terminalClass.id, progressClass.id].includes(id))) { const pool = makePool(entry); pools.push(pool); partitions.push(makePartition(entry, pool, '0', null, String(cleanupOrder++))); }
  const terminalReserve = `resource.${PROFILE}.reserve-terminal`;
  const progressReserve = `resource.${PROFILE}.reserve-progress`;
  const reserves = [
    { id: terminalReserve, purpose: 'terminal-result', class: terminalClass.id, partition: partitions.find(({ class: id }) => id === terminalClass.id).id, minimum: '4096', maximum: '4096', eligibleOwners: [outputOwner.id], eligibleTransitions: ['resource.transition-publish-terminal'], borrow: { kind: 'none' }, release: schemaReference('vector.mcgs-external.terminal-reserve-release'), priority: '1' },
    { id: progressReserve, purpose: 'progress-cleanup', class: progressClass.id, partition: partitions.find(({ class: id }) => id === progressClass.id).id, minimum: '8192', maximum: '8192', eligibleOwners: contributors.map(({ id }) => id), eligibleTransitions: ['resource.transition-drain', 'resource.transition-teardown'], borrow: { kind: 'none' }, release: schemaReference('vector.mcgs-external.progress-reserve-release'), priority: '2' },
  ];
  const admissionGroups = [makeAdmissionGroup([terminalClass, progressClass], coreAdmission, true)];
  for (const entry of classes.filter(({ id }) => ![terminalClass.id, progressClass.id].includes(id))) admissionGroups.push(makeAdmissionGroup([entry], entry.admissionGroup));
  const ledgers = classes.map(makeLedger);
  const watermarks = classes.map((entry) => makeWatermark(entry, progressReserve));
  const providerRequirements = pools.map(makeProvider);
  return {
    schema: 'cuda-mcgs.resource-profile/0.2.0', representation: REPRESENTATION, status: 'accepted', contract: catalogContract(authority, 'SPEC-0011'), id: `resource.${PROFILE}`, version: VERSION,
    contributors, classes, pools, partitions, reserves, admissionGroups, ledgers, watermarks,
    exhaustion: { causes: ['capacity', 'fragmentation-fit', 'identifier-space', 'generation-space', 'counter-width', 'provider-failure', 'policy-budget'], firstCause: 'immutable-first-terminal-cas', publication: schemaReference('vector.mcgs-external.resource-exhaustion-publication'), stopComposition: schemaReference('vector.mcgs-external.resource-stop-composition'), readyOnly: true, hostGrowth: 'none', counterWrap: 'prohibited', terminalReserve },
    lifecycle: { states: ['profile-normalized', 'physical-plan-admitted', 'pools-ledgers-initialized', 'active', 'draining', 'terminal', 'released'], failure: schemaReference('vector.mcgs-external.resource-lifecycle-failure'), quarantine: schemaReference('vector.mcgs-external.resource-lifecycle-quarantine'), rollback: schemaReference('vector.mcgs-external.resource-lifecycle-rollback'), teardown: schemaReference('vector.mcgs-external.resource-lifecycle-teardown'), admissionClosedAt: 'draining' },
    ports: ['normalize-contribution', 'compose-resource-plan', 'admit-engine-resources', 'reserve-resource', 'reserve-compound', 'publish-resource-use', 'release-resource', 'retire-resource', 'reclaim-resource-accounting', 'observe-resource-state', 'terminate-resource-profile'].map(resourcePort),
    statuses: Object.entries(RESOURCE_STATUS_CLASSES).map(([code, statusClass]) => ({ code, class: statusClass, diagnostic: true })), providerRequirements,
    diagnostics: { authority: 'non-authoritative', maxRecords: '64', maxBytes: '8192', overflow: 'count', rawAddresses: false, privatePayloads: false },
    compatibility: { providerIdentityRequired: true, packageIdentityRequired: true, persistence: { kind: 'none' } },
    cleanup: { kinds: ['allocation-binding', 'pool', 'partition', 'reserve', 'lease', 'transaction', 'retired-range', 'quarantined-range', 'counter', 'diagnostic', 'plan-ledger-artifact'], disposition: schemaReference('vector.mcgs-external.resource-cleanup-disposition'), quarantine: schemaReference('vector.mcgs-external.resource-cleanup-quarantine'), releaseOrder: schemaReference('vector.mcgs-external.resource-cleanup-order'), retainedEvidence: schemaReference('vector.mcgs-external.resource-cleanup-evidence') },
    programContribution: { kind: 'device-program', language: 'restricted-device-js', sourceIdentity: sourceIdentity(source), inputs: contributors.map(({ profile }) => profile), provenance: { origin: 'first-party', revision: vectorRevision, license: 'GPL-3.0-or-later', review: schemaReference('vector.mcgs-external.resource-program-review') } },
    productData: [],
  };
}
