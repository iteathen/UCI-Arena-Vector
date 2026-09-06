import { PROFILE, REPRESENTATION, U64_MAX, VERSION, catalogContract, profileReference, schemaReference, sourceIdentity, workBounds } from './shared.mjs';
import { domainReference } from './domain.mjs';

const POLICY_STATUS_CLASSES = {
  'backup-target-stale': 'recoverable', cancelled: 'cancellation', 'duplicate-backup': 'fatal',
  'invalid-action-candidate': 'recoverable', 'invalid-policy-profile': 'fatal', 'invalid-policy-record': 'fatal',
  'invalid-value': 'fatal', 'no-eligible-candidate': 'normal', 'partial-backup-fatal': 'fatal',
  'policy-budget-counter-exhausted': 'fatal', 'policy-budget-satisfied': 'stop', 'policy-generation-exhausted': 'fatal',
  'policy-internal-failure': 'fatal', 'required-input-unavailable': 'pending', 'reservation-capacity': 'recoverable',
  'reservation-imbalance': 'fatal', 'statistics-overflow': 'fatal', 'unsupported-cycle-relation': 'fatal',
  'unsupported-domain-role': 'fatal', 'value-schema-mismatch': 'fatal',
};

function policyNumeric() {
  return {
    kind: 'finite-numeric', representation: 'integer', storageBits: '64', accumulationBits: '64',
    range: schemaReference('vector.mcgs-external.policy-range'), precision: schemaReference('vector.mcgs-external.policy-precision'),
    rounding: 'exact', nonfinite: 'not-representable', overflow: 'typed-stop', order: 'associative-commutative',
  };
}

function policyRecord() {
  return {
    id: `policy.${PROFILE}.record-budget`, scope: 'global', semanticKind: 'budget', unit: `policy.${PROFILE}.unit-budget`,
    schema: schemaReference('vector.mcgs-external.policy-budget-record'),
    storage: { objectRole: 'separate-policy-arena', sizeBytes: '64', alignmentBytes: '8', layout: schemaReference('vector.mcgs-external.policy-budget-layout'), lifecycle: schemaReference('vector.mcgs-external.policy-budget-lifecycle') },
    initialization: schemaReference('vector.mcgs-external.policy-budget-init'), operations: [`policy.${PROFILE}.operation-budget`], numeric: policyNumeric(),
    visibility: 'release-acquire', resultVisible: false,
  };
}

function policyPort(id, recordId) {
  return { id, contract: schemaReference(`vector.mcgs-external.policy-port-${id}`), records: [recordId], bounds: workBounds(), completion: 'bounded', statuses: ['cancelled', 'policy-internal-failure', 'required-input-unavailable'] };
}

export function buildPolicyInput(authority, vectorRevision, domainResult, graphResult, source) {
  const record = policyRecord();
  const produceActions = domainResult.normalized.ports.find(({ id }) => id === 'produce-actions').contract;
  return {
    schema: 'cuda-mcgs.policy-profile/0.2.0', representation: REPRESENTATION, status: 'accepted', contract: catalogContract(authority, 'SPEC-0008'),
    id: `policy.${PROFILE}`, version: VERSION, domainProfile: domainReference(domainResult), graphProfile: { ...profileReference(graphResult), mode: 'stateless' }, evaluatorMode: 'absent',
    roleHandlers: domainResult.normalized.roles.map(({ id: role, category, terminal }) => ({
      role, category, candidateSources: terminal ? ['none'] : ['action-source'], readiness: terminal ? 'terminal' : 'required',
      selectionMode: terminal ? 'terminal' : (category === 'decision' ? 'compare' : 'custom'), noActionOutcome: terminal ? 'policy-budget-satisfied' : 'no-eligible-candidate', failure: 'unsupported-domain-role',
    })),
    records: [record],
    selection: {
      inputs: ['domain-role', 'policy-records', 'resource-facts', 'stop-facts'], eligibility: schemaReference('vector.mcgs-external.policy-eligibility'),
      comparison: { kind: 'custom', semantics: schemaReference('vector.mcgs-external.policy-comparison') }, tie: 'canonical', determinism: 'deterministic',
      randomness: { kind: 'none', maxInputs: '0' }, maxCandidates: '4', bounds: workBounds(),
      noSelectionOutcomes: ['cancelled', 'no-eligible-candidate', 'policy-budget-satisfied', 'required-input-unavailable'],
    },
    reservation: { kind: 'none' },
    admission: {
      mode: 'progressive',
      sources: [{ id: `policy.${PROFILE}.source-domain`, kind: 'intrinsic-domain', source: produceActions, producerProfile: { kind: 'none' }, readiness: 'required', fallback: 'pending', maxCandidates: '4', maxBytes: '256', maxRandomInputs: '0', multiplicity: 'unique', edgeAdmissionIdentity: { kind: 'none' } }],
      threshold: schemaReference('vector.mcgs-external.policy-admission-threshold'), pressure: 'required-input-unavailable', bounds: workBounds(),
    },
    value: { kind: 'none' }, cycle: { kind: 'none' }, backup: { kind: 'none' },
    stop: {
      budgets: [{ id: `policy.${PROFILE}.budget`, unit: `policy.${PROFILE}.unit-budget`, scope: 'root-epoch', initial: '0', limit: U64_MAX,
        increment: schemaReference('vector.mcgs-external.policy-budget-increment'), widthBits: '64', precision: schemaReference('vector.mcgs-external.policy-budget-counter-precision'),
        comparison: schemaReference('vector.mcgs-external.policy-budget-counter-comparison'), satisfaction: schemaReference('vector.mcgs-external.policy-budget-satisfaction'), exhaustion: 'policy-budget-counter-exhausted', monotonicity: 'monotone' }],
      causePriority: ['policy-budget-satisfied', 'cancelled', 'policy-internal-failure'], lifecycle: schemaReference('vector.mcgs-external.policy-stop-lifecycle'),
      maxOvershoot: '4', drain: schemaReference('vector.mcgs-external.policy-stop-drain'), partialEligibility: schemaReference('vector.mcgs-external.policy-partial-eligibility'), externalControl: 'none',
    },
    reuse: [{ record: record.id, disposition: 'retain', condition: schemaReference('vector.mcgs-external.policy-reuse-condition'), ordering: schemaReference('vector.mcgs-external.policy-reuse-ordering'), lifecycle: schemaReference('vector.mcgs-external.policy-reuse-lifecycle') }],
    ports: ['classify-policy-reuse', 'classify-role-handler', 'decide-action-admission', 'evaluate-policy-stop', 'initialize-policy-records', 'select-next'].map((id) => policyPort(id, record.id)),
    resources: [
      { id: `policy.${PROFILE}.resource-records`, unit: 'bytes', minimum: '1', maximum: '1024', alignment: '8', scope: 'per-engine', pressureStatus: 'policy-internal-failure' },
      { id: `policy.${PROFILE}.resource-work`, unit: 'work-units', minimum: '1', maximum: '64', alignment: '8', scope: 'per-worker', pressureStatus: 'required-input-unavailable' },
    ],
    statuses: Object.entries(POLICY_STATUS_CLASSES).map(([code, statusClass]) => ({ code, class: statusClass, diagnostic: true })),
    diagnostics: { authority: 'non-authoritative', maxRecords: '16', maxBytes: '2048', overflow: 'count', rawAddresses: false },
    compatibility: { domainIdentityRequired: true, graphIdentityRequired: true, persistence: { kind: 'none' } },
    programContribution: { kind: 'device-program', language: 'restricted-device-js', sourceIdentity: sourceIdentity(source), inputs: [profileReference(domainResult), profileReference(graphResult)], provenance: { origin: 'first-party', revision: vectorRevision, license: 'GPL-3.0-or-later' } },
    productData: [],
  };
}
