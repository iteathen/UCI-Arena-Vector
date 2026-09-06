import { PROFILE, REPRESENTATION, VERSION, catalogContract, contentIdentity, profileReference, schemaReference, sourceIdentity, workBounds } from './shared.mjs';

const VALUE_ROLES = [
  'action', 'action-cursor', 'action-key', 'diagnostic', 'history', 'identity-key', 'operation-status',
  'path-relation', 'random-input', 'role-key', 'root-descriptor', 'state', 'terminal-outcome',
  'transition-input', 'transition-metadata', 'transition-output', 'truth-value',
];

const DOMAIN_FAILURES = {
  cancelled: 'cancellation',
  'capacity-required': 'capacity',
  'domain-history-exhausted': 'exhaustion',
  'domain-internal-failure': 'internal',
  'incompatible-action-producer': 'compatibility',
  'invalid-input': 'input',
  'invalid-action-scope': 'input',
  'invalid-cursor': 'input',
  'invalid-profile': 'input',
  'invalid-root': 'input',
  'invalid-state': 'input',
  'unsupported-domain-case': 'unsupported',
};

function domainValueSchemas() {
  const definitions = {
    action: ['variable-record', '32', ['device-search']],
    'action-cursor': ['fixed-record', '8', ['device-search']],
    'action-key': ['fixed-record', '8', ['device-search']],
    diagnostic: ['variable-record', '64', ['device-search', 'device-publication']],
    history: ['unit', '0', ['device-search']],
    'identity-key': ['fixed-record', '16', ['device-search']],
    'operation-status': ['tagged-union', '8', ['device-search']],
    'path-relation': ['tagged-union', '8', ['device-search']],
    'random-input': ['unit', '0', ['device-search']],
    'role-key': ['fixed-record', '8', ['device-search']],
    'root-descriptor': ['variable-record', '64', ['host-admission', 'device-search']],
    state: ['variable-record', '64', ['device-search']],
    'terminal-outcome': ['tagged-union', '32', ['device-search', 'device-publication']],
    'transition-input': ['unit', '0', ['device-search']],
    'transition-metadata': ['unit', '0', ['device-search']],
    'transition-output': ['variable-record', '64', ['device-search']],
    'truth-value': ['scalar', '1', ['device-search']],
  };
  return VALUE_ROLES.map((semanticRole) => {
    const [family, maxEncodedBytes, memorySpaces] = definitions[semanticRole];
    return {
      id: `domain.${PROFILE}.value-${semanticRole}`,
      semanticRole,
      schema: schemaReference(`vector.mcgs-external.${semanticRole}`),
      family,
      maxEncodedBytes,
      alignmentBytes: family === 'unit' ? '1' : '8',
      memorySpaces,
      decoding: ['state', 'action', 'history'].includes(semanticRole) ? 'profile-semantic-equivalence' : 'canonical-bytes',
    };
  });
}

function domainValue(role) { return `domain.${PROFILE}.value-${role}`; }

function domainPort(id, inputs, outputs, failures, options = {}) {
  return {
    id,
    contract: schemaReference(`vector.mcgs-external.domain-port-${id}`),
    inputs: inputs.map(domainValue),
    outputs: outputs.map(domainValue),
    failures,
    bounds: workBounds(options.bounds),
    completion: options.resumable
      ? { kind: 'resumable', continuationValue: domainValue('action-cursor'), maxResumptions: '8', partialPublication: 'forbidden' }
      : { kind: 'bounded' },
  };
}

export function buildDomainInput(authority, vectorRevision, source) {
  const sourceId = `domain.${PROFILE}.source-actions`;
  const transitionId = `domain.${PROFILE}.transition`;
  const decisionRole = `domain.${PROFILE}.role-decision`;
  const terminalRole = `domain.${PROFILE}.role-terminal`;
  return {
    schema: 'cuda-mcgs.domain-profile/0.2.0',
    representation: REPRESENTATION,
    status: 'accepted',
    contract: catalogContract(authority, 'SPEC-0007'),
    id: `domain.${PROFILE}`,
    version: VERSION,
    valueSchemas: domainValueSchemas(),
    identity: {
      scope: 'engine-incarnation', keyValue: domainValue('identity-key'), stateEquality: 'semantic-port', actionEquality: 'semantic-port',
      actionScope: { kind: 'origin-state-view-and-production-incarnation' }, collisionVerification: 'authoritative-equality-port',
      behaviorFacts: [`domain.${PROFILE}.fact-state`, `domain.${PROFILE}.fact-no-history`], readyPayloads: 'immutable',
    },
    history: {
      disposition: 'none', valueSchema: domainValue('history'), identityParticipation: 'none', finiteRule: { kind: 'none' },
      reuse: [
        { boundary: 'root-advance', disposition: 'valid' },
        { boundary: 'restart', disposition: 'invalid' },
        { boundary: 'persistence', disposition: 'invalid' },
      ],
    },
    rootForms: [{ id: `domain.${PROFILE}.root`, authority: 'complete-state', schema: schemaReference('vector.mcgs-external.root'), valueSchema: domainValue('root-descriptor') }],
    roles: [
      { id: decisionRole, category: 'decision', terminal: false, selectorAuthority: `domain.${PROFILE}.selector`, actionSources: [sourceId], transitionMode: transitionId, successorRoles: [decisionRole, terminalRole], zeroActionDisposition: `domain.${PROFILE}.zero-action` },
      { id: terminalRole, category: 'terminal', terminal: true, terminalOutcomeValue: domainValue('terminal-outcome') },
    ],
    actionSources: [{
      id: sourceId, kind: 'intrinsic', mode: 'paged', ordering: 'semantic', multiplicity: 'unique', cursorValue: domainValue('action-cursor'),
      candidateValue: domainValue('action'), maxActions: '4', bounds: workBounds(), completion: 'finite-complete',
      randomness: { kind: 'none', maxInputs: '0' }, semantics: schemaReference('vector.mcgs-external.actions'),
    }],
    transitionModes: [{
      id: transitionId, kind: 'deterministic', inputValue: domainValue('transition-input'), outputValue: domainValue('transition-output'),
      metadataValue: domainValue('transition-metadata'), randomness: { kind: 'none', maxInputs: '0' }, observation: 'none', numericRules: [],
      semantics: schemaReference('vector.mcgs-external.transition'),
    }],
    ports: [
      domainPort('action-key', ['state', 'history', 'action'], ['action-key', 'operation-status'], ['invalid-action-scope', 'domain-internal-failure']),
      domainPort('apply-transition', ['state', 'history', 'action', 'transition-input', 'random-input'], ['state', 'history', 'transition-output', 'transition-metadata', 'operation-status'], ['invalid-action-scope', 'capacity-required', 'cancelled', 'domain-internal-failure']),
      domainPort('classify-path-relation', ['state', 'history'], ['path-relation', 'operation-status'], ['invalid-state', 'domain-internal-failure']),
      domainPort('classify-role', ['state', 'history'], ['role-key', 'operation-status'], ['invalid-state', 'domain-internal-failure']),
      domainPort('equal-action', ['state', 'history', 'action'], ['truth-value', 'operation-status'], ['invalid-action-scope', 'domain-internal-failure']),
      domainPort('equal-state', ['state', 'history'], ['truth-value', 'operation-status'], ['invalid-state', 'domain-internal-failure']),
      domainPort('identity-key', ['state', 'history'], ['identity-key', 'operation-status'], ['invalid-state', 'domain-internal-failure']),
      domainPort('terminal-outcome', ['state', 'history'], ['terminal-outcome', 'operation-status'], ['invalid-state', 'unsupported-domain-case', 'domain-internal-failure']),
      domainPort('validate-action', ['state', 'history', 'action'], ['action', 'operation-status'], ['invalid-action-scope', 'incompatible-action-producer', 'domain-internal-failure']),
      domainPort('validate-root', ['root-descriptor'], ['state', 'history', 'role-key', 'operation-status'], ['invalid-root', 'invalid-state', 'capacity-required', 'domain-internal-failure']),
      domainPort('produce-actions', ['state', 'history', 'action-cursor', 'random-input'], ['action', 'action-cursor', 'operation-status'], ['invalid-cursor', 'capacity-required', 'cancelled', 'domain-internal-failure'], { resumable: true }),
    ],
    resources: [{ id: `domain.${PROFILE}.resource-work`, unit: 'work-units', minimum: '1', maximum: '64', alignment: '8', memorySpaces: ['device-search'], scope: 'per-worker', pressureOutcome: 'capacity-required' }],
    failures: Object.entries(DOMAIN_FAILURES).map(([code, kind]) => ({ code, kind, diagnostic: true })),
    diagnostics: { authority: 'non-authoritative', maxRecords: '16', maxBytes: '1024', overflow: 'count' },
    compatibility: { crossProfileEquality: 'false-unless-versioned-compatibility', persistence: { kind: 'none' }, hostDeviceRepresentation: { kind: 'identical' } },
    programContribution: {
      language: 'restricted-device-js', sourceIdentity: sourceIdentity(source),
      inputs: [{ id: `domain.${PROFILE}.program-input`, schema: schemaReference('vector.mcgs-external.domain-program-input'), identity: contentIdentity('domain-program-input') }],
      provenance: { origin: 'first-party', revision: vectorRevision, license: 'GPL-3.0-or-later' },
    },
    productData: [],
  };
}

export function domainReference(domainResult) {
  const ports = new Map(domainResult.normalized.ports.map(({ id, contract }) => [id, contract]));
  return {
    ...profileReference(domainResult),
    classifyRolePort: ports.get('classify-role'),
    produceActionsPort: ports.get('produce-actions'),
    terminalOutcomePort: ports.get('terminal-outcome'),
    classifyPathRelationPort: ports.get('classify-path-relation'),
  };
}

export function buildGraphInput(authority, domainResult) {
  const ports = new Map(domainResult.normalized.ports.map(({ id, contract }) => [id, contract]));
  return {
    schema: 'cuda-mcgs.graph-profile/0.2.0', representation: REPRESENTATION, status: 'accepted',
    contract: catalogContract(authority, 'SPEC-0010'), id: `graph.${PROFILE}`, version: VERSION,
    domainProfile: {
      ...profileReference(domainResult),
      identityKeyPort: ports.get('identity-key'), equalStatePort: ports.get('equal-state'), classifyPathRelationPort: ports.get('classify-path-relation'),
    },
    mode: 'stateless', arena: { kind: 'none' }, referenceEncoding: { kind: 'none' }, objectKinds: [], layouts: [], ownerRegions: [],
    transposition: { kind: 'none' }, path: { kind: 'none' }, rootProtection: { kind: 'none' }, reclamation: { kind: 'none', disposition: 'retain-until-arena-teardown' },
    publications: [], ports: [], resources: [], failures: [],
    diagnostics: { authority: 'non-authoritative', maxRecords: '0', maxBytes: '0', overflow: 'drop', rawAddresses: false },
    compatibility: { domainIdentityRequired: true, persistence: { kind: 'none' } }, programContribution: { kind: 'none' },
  };
}
