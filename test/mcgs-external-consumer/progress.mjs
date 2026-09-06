import { PROFILE, REPRESENTATION, U128_MAX, VERSION, catalogContract, contentIdentity, profileReference, schemaReference, sourceIdentity } from './shared.mjs';

const PROGRESS_STATUS_CLASSES = {
  'invalid-progress-profile': 'fatal', 'work-capacity': 'pending', 'work-stale': 'stop', 'producer-unavailable': 'pending',
  'progress-deadlock': 'fatal', 'progress-livelock': 'fatal', 'progress-starvation': 'fatal', 'orphaned-work': 'fatal',
  'progress-counter-exhausted': 'stop', 'progress-cancelled': 'cancellation', 'progress-internal-failure': 'fatal',
  'progress-work-complete': 'normal',
};

function progressTransition(ownerId, suffix) { return schemaReference(`vector.mcgs-external.progress-${ownerId.replaceAll('.', '-')}-${suffix}`); }
function progressBounds(overrides = {}) { return { maxAdmitted: overrides.maxAdmitted ?? '1024', maxProducedPerStep: overrides.maxProducedPerStep ?? '8', maxStepsPerAttempt: overrides.maxStepsPerAttempt ?? '32', maxRetries: overrides.maxRetries ?? '4', maxContinuationDepth: overrides.maxContinuationDepth ?? '16', maxWaitTransitions: overrides.maxWaitTransitions ?? '128', counterMaximum: U128_MAX, cancellationObservationWorkUnits: overrides.cancellationObservationWorkUnits ?? '8' }; }
function progressKind(contractId) { return ({ 'SPEC-0010': 'producer-unblocking', 'SPEC-0011': 'resource-recovery', 'SPEC-0012': 'must-drain', 'SPEC-0013': 'terminal-output' })[contractId] ?? 'ordinary'; }
function stopDisposition(kind) { return ['must-drain', 'terminal-output'].includes(kind) ? 'drain' : (['producer-unblocking', 'resource-recovery'].includes(kind) ? 'service' : 'abandon'); }

export function buildProgressInput(authority, vectorRevision, resourceResult, source) {
  const resourcePlan = resourceResult.normalized;
  const transitions = new Map(resourcePlan.contributors.map(({ id }) => [id, { ready: progressTransition(id, 'ready'), completion: progressTransition(id, 'complete') }]));
  const contributors = resourcePlan.contributors.map((entry) => ({ id: entry.id, contract: entry.contract, profile: entry.profile, optional: entry.optional, workClasses: [`work.${PROFILE}.${entry.id.replaceAll('.', '-')}`], publicTransitions: [transitions.get(entry.id).ready, transitions.get(entry.id).completion], cleanup: progressTransition(entry.id, 'owner-cleanup') }));
  const workClasses = contributors.map((contributor) => {
    const kind = progressKind(contributor.contract.id);
    const progressReserve = resourcePlan.reserves.find(({ purpose }) => purpose === 'progress-cleanup').id;
    const terminalReserve = resourcePlan.reserves.find(({ purpose }) => purpose === 'terminal-result').id;
    const continuing = kind === 'must-drain';
    const disposition = stopDisposition(kind);
    return {
      id: contributor.workClasses[0], version: VERSION, owner: contributor.id, kind, payload: progressTransition(contributor.id, 'payload'),
      inputStates: [`work.${PROFILE}.admitted`], outputStates: [`work.${PROFILE}.published`, `work.${PROFILE}.terminal`],
      readiness: { mode: 'any-with-independent', predicate: progressTransition(contributor.id, 'readiness'), publication: transitions.get(contributor.id).ready, independentReady: true, dependencies: [] },
      resources: resourcePlan.classes.filter(({ contributor: owner }) => owner === contributor.id).map(({ id }) => id),
      reserve: kind === 'terminal-output' ? terminalReserve : (['producer-unblocking', 'must-drain', 'resource-recovery'].includes(kind) ? progressReserve : null),
      bounds: progressBounds(), fairness: `fairness.${PROFILE}.${['producer-unblocking', 'must-drain', 'terminal-output', 'resource-recovery'].includes(kind) ? 'closure' : 'ordinary'}`,
      batch: { kind: 'none' }, claim: 'exclusive',
      step: { contract: progressTransition(contributor.id, 'step'), completion: continuing ? 'finite-continuation' : 'bounded', continuationIdentity: continuing ? progressTransition(contributor.id, 'continuation') : null, publication: transitions.get(contributor.id).completion, failure: progressTransition(contributor.id, 'failure') },
      retry: { staleSafe: true, idempotence: progressTransition(contributor.id, 'retry') }, cancellation: progressTransition(contributor.id, 'cancellation'), stale: progressTransition(contributor.id, 'stale'),
      stopDisposition: disposition, terminalStates: ['completed', 'failed', 'cancelled', ...(disposition === 'abandon' ? ['abandoned'] : []), 'stale-disposed', 'quarantined'],
      status: 'progress-work-complete', cleanup: progressTransition(contributor.id, 'work-cleanup'),
    };
  });
  const byOwner = new Map(workClasses.map((entry) => [entry.owner, entry]));
  const ownerFor = (contractId) => contributors.find(({ contract }) => contract.id === contractId)?.id;
  const dependencies = [];
  function dependency(consumerOwner, producerOwner, producerKind, requirement) {
    const id = `dependency.${PROFILE}.${consumerOwner.replaceAll('.', '-')}-on-${producerOwner.replaceAll('.', '-')}`;
    dependencies.push({ id, consumer: byOwner.get(consumerOwner).id, producer: { kind: producerKind, owner: producerOwner, workClass: producerKind === 'work-class' ? byOwner.get(producerOwner).id : null, fact: transitions.get(producerOwner).completion }, requirement, publication: progressTransition(id, 'publication'), incarnation: progressTransition(id, 'incarnation'), escapes: requirement === 'advisory' ? ['failure', 'cancel', 'stop', 'fallback', 'stale'] : ['failure', 'cancel', 'stop', 'stale'], maxWaitTransitions: '128', fallback: requirement === 'advisory' ? progressTransition(id, 'fallback') : null, holdsWorker: false, holdsProducerResource: false });
    const consumer = byOwner.get(consumerOwner);
    consumer.readiness.dependencies.push(id);
    if (requirement === 'required') { consumer.readiness.mode = 'all'; consumer.readiness.independentReady = false; }
  }
  dependency(ownerFor('SPEC-0007'), ownerFor('SPEC-0011'), 'fact', 'advisory');
  dependency(ownerFor('SPEC-0010'), ownerFor('SPEC-0007'), 'work-class', 'required');
  dependency(ownerFor('SPEC-0008'), ownerFor('SPEC-0010'), 'work-class', 'required');
  dependency(ownerFor('SPEC-0013'), ownerFor('SPEC-0008'), 'work-class', 'required');
  dependency(ownerFor('SPEC-0012'), ownerFor('SPEC-0011'), 'resource-recovery', 'required');
  const closureKinds = new Set(['producer-unblocking', 'must-drain', 'terminal-output', 'resource-recovery']);
  const fairnessClasses = [
    { id: `fairness.${PROFILE}.closure`, mode: 'priority-with-starvation-escape', classes: workClasses.filter(({ kind }) => closureKinds.has(kind)).map(({ id }) => id), maxServiceOpportunities: '32', priority: '0', serviceOpportunity: schemaReference('vector.mcgs-external.progress-closure-opportunity'), starvationEscape: schemaReference('vector.mcgs-external.progress-closure-escape'), closurePriority: true },
    { id: `fairness.${PROFILE}.ordinary`, mode: 'bounded-service-gap', classes: workClasses.filter(({ kind }) => !closureKinds.has(kind)).map(({ id }) => id), maxServiceOpportunities: '64', priority: '1', serviceOpportunity: schemaReference('vector.mcgs-external.progress-ordinary-opportunity'), starvationEscape: null, closurePriority: false },
  ];
  const selectedProgressContribution = resourcePlan.contributors.find(({ contract }) => contract.id === 'SPEC-0012');
  return {
    schema: 'cuda-mcgs.progress-profile/0.2.0', representation: REPRESENTATION, status: 'accepted', contract: catalogContract(authority, 'SPEC-0012'), id: `progress.${PROFILE}`, version: VERSION,
    resourcePlan: profileReference(resourceResult), resourceContribution: selectedProgressContribution.profile, contributors, workClasses, dependencies, fairnessClasses,
    noProgress: { outcomes: ['terminal-quiescent', 'legitimate-external-wait', 'recoverable-resource-wait', 'producer-pending', 'deadlock', 'livelock', 'starvation', 'orphaned-work', 'stale-only', 'counter-exhausted'], classifier: schemaReference('vector.mcgs-external.progress-no-progress'), waitGraph: schemaReference('vector.mcgs-external.progress-wait-graph'), potential: schemaReference('vector.mcgs-external.progress-potential'), maxRepeatedTransitions: '1024', maxEvidenceRecords: '64', source: 'device-visible-ready-facts', firstCause: 'immutable-first-fatal-cas', hostObservation: 'non-progressing', externalWait: { kind: 'absent' } },
    stop: { states: ['running', 'stop-requested', 'draining', 'terminal'], firstCause: 'immutable-first-cas', ordinaryAdmissionClosedAt: 'stop-requested', mustDrainKinds: ['must-drain', 'terminal-output', 'producer-unblocking', 'resource-recovery'], epochChange: schemaReference('vector.mcgs-external.progress-epoch-change'), observationDependency: 'none', counterWrap: 'prohibited' },
    closure: { workClasses: workClasses.map(({ id }) => id), workAccounting: 'all-admitted-terminal', channels: 'all-required-terminal', ownerTransitions: 'ready-or-quarantined', resources: 'conservation-reconciled', terminalOutput: 'publishable-from-reserve', publication: schemaReference('vector.mcgs-external.progress-closure-publication'), observationAckRequired: false, outputBorrow: { kind: 'none' }, conflict: schemaReference('vector.mcgs-external.progress-closure-conflict') },
    lifecycle: { states: ['profile-normalized', 'resources-admitted', 'initialized', 'running', 'draining', 'terminal', 'released'], failure: schemaReference('vector.mcgs-external.progress-lifecycle-failure'), quarantine: schemaReference('vector.mcgs-external.progress-lifecycle-quarantine'), teardown: schemaReference('vector.mcgs-external.progress-lifecycle-teardown'), release: schemaReference('vector.mcgs-external.progress-lifecycle-release') },
    ports: ['admit-work', 'publish-ready', 'claim-ready', 'yield-pending', 'complete-work', 'fail-work', 'cancel-work', 'observe-progress', 'request-stop', 'classify-no-progress', 'publish-closure'].map((id) => ({ id, phase: 'device-active', contract: schemaReference(`vector.mcgs-external.progress-port-${id}`), bounds: progressBounds({ maxStepsPerAttempt: id === 'publish-closure' ? '64' : '32' }), completion: id === 'publish-closure' ? 'must-drain' : (id === 'classify-no-progress' ? 'finite-continuation' : 'bounded'), statuses: ['work-capacity', 'work-stale', 'progress-cancelled', 'progress-internal-failure'] })),
    statuses: Object.entries(PROGRESS_STATUS_CLASSES).map(([code, statusClass]) => ({ code, class: statusClass, diagnostic: true })),
    diagnostics: { authority: 'non-authoritative', maxRecords: '64', maxBytes: '8192', overflow: 'count', rawAddresses: false, privatePayloads: false, wallClock: false },
    compatibility: { packageIdentityRequired: true, schedulerIdentityExcluded: true, persistence: { kind: 'none' } },
    cleanup: { kinds: ['descriptor', 'work-record', 'dependency', 'ready-record', 'claim', 'continuation', 'fairness-counter', 'wait-graph', 'no-progress-evidence', 'stop-record', 'closure-record', 'diagnostic', 'program-artifact'], disposition: schemaReference('vector.mcgs-external.progress-cleanup-disposition'), quarantine: schemaReference('vector.mcgs-external.progress-cleanup-quarantine'), releaseOrder: schemaReference('vector.mcgs-external.progress-cleanup-order'), retainedEvidence: schemaReference('vector.mcgs-external.progress-cleanup-evidence') },
    programContribution: { kind: 'device-program', language: 'restricted-device-js', sourceIdentity: sourceIdentity(source), inputs: [...contributors.map(({ profile }) => profile), profileReference(resourceResult)], provenance: { origin: 'first-party', revision: vectorRevision, license: 'GPL-3.0-or-later', review: schemaReference('vector.mcgs-external.progress-program-review') } },
    productData: [],
  };
}
