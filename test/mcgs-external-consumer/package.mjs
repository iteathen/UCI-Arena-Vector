import { CUDA_JS_PACKAGE, CUDA_JS_REPOSITORY, CUDA_JS_REVISION, MCGS_REPOSITORY, PROFILE, REPRESENTATION, VERSION, canonicalSource, catalogContract, profileReference, schemaReference, sourceIdentity } from './shared.mjs';

function packageResourceRequirements(resourceResult) {
  return resourceResult.normalized.providerRequirements.map((provider, index) => ({
    id: `package.${PROFILE}.resource-${index}`,
    ownerProfile: resourceResult.normalized.id,
    providerRequirement: provider.id,
    materialization: provider.unit === 'bytes' && provider.memorySpaces.some((space) => ['device-search', 'device-publication'].includes(space)) ? 'resident-storage' : 'semantic-only',
    unit: provider.unit,
    capacity: provider.capacity,
    alignment: provider.alignment,
    memorySpaces: [...provider.memorySpaces],
    access: [...provider.access],
  }));
}

function buildDelivery(resourceResult, outputResult, packageResources) {
  const plan = resourceResult.normalized;
  const output = outputResult.normalized;
  const reserve = plan.reserves.find(({ id }) => id === output.terminalEnvelope.terminalReserve);
  const partition = plan.partitions.find(({ id }) => id === reserve.partition);
  const pool = plan.pools.find(({ id }) => id === partition.pool);
  const resource = packageResources.find(({ providerRequirement }) => providerRequirement === pool.providerRequirement);
  return {
    id: `delivery.${PROFILE}.terminal`, semanticOwner: output.id, role: 'terminal-output', terminalSchema: output.terminal.schema,
    resource: resource.id, byteOffset: partition.offset, byteLength: reserve.maximum, readiness: 'terminal-completed', mode: 'asynchronous-bounded-read',
    maxTransfers: output.publication.maxTransfers, borrow: { ...output.terminal.borrow }, asyncRead: { ...output.terminal.asyncRead }, cleanup: { ...output.terminal.cleanup }, lifetime: 'terminal-result',
  };
}

function sourceUnit(owner, kind, source, functions, revision, contributionIdentity) {
  return {
    id: `source.${PROFILE}.${owner.replaceAll('.', '-')}`, ownerProfile: owner, semanticOwner: owner, kind,
    source: canonicalSource(source), sourceIdentity: sourceIdentity(source), contributionIdentity, functions,
    provenance: { origin: 'first-party', trust: 'first-party-reviewed', revision, license: 'GPL-3.0-or-later', review: schemaReference(`vector.mcgs-external.source-review-${owner.replaceAll('.', '-')}`) },
  };
}

export function buildPackageProfile(authority, mcgsRevision, vectorRevision, ownerResults, sources) {
  const [domainResult, graphResult, policyResult, resourceResult, progressResult, outputResult] = ownerResults;
  const packageId = `program-package.${PROFILE}`;
  const packageResources = packageResourceRequirements(resourceResult);
  const delivery = buildDelivery(resourceResult, outputResult, packageResources);
  const cancellation = {
    id: `sideband.${PROFILE}.framework-cancellation`, semanticOwner: progressResult.normalized.id, role: 'framework-cancellation', direction: 'host-to-device', valueType: 'u32', capacity: '1', publication: 'release-acquire',
    applicationPoint: schemaReference('vector.mcgs-external.framework-cancellation-checkpoint'), lifetime: 'operation', residentResource: null,
    semantics: schemaReference('vector.mcgs-external.framework-cancellation-semantics'), cleanup: schemaReference('vector.mcgs-external.framework-cancellation-cleanup'),
  };
  const sourceUnits = [];
  const functions = [];
  const programUnits = [];
  for (const result of ownerResults) {
    const contribution = result.normalized.programContribution;
    if (!contribution?.sourceIdentity) continue;
    const source = sources[result.normalized.id];
    const fnName = `${result.normalized.id.split('.')[0]}Step`;
    const unit = sourceUnit(result.normalized.id, 'source-owner', source, [fnName], vectorRevision, contribution.sourceIdentity);
    sourceUnits.push(unit);
    functions.push({ name: fnName, executionRole: 'device-callable', parameters: [], returns: 'u32', sourceUnit: unit.id, ownerProfile: result.normalized.id, semanticRole: `${result.normalized.id}.program-step`, calls: [], helpers: [] });
    programUnits.push({ id: `program-unit.${PROFILE}.${fnName.toLowerCase()}`, kind: 'owner', surface: null, contributors: [result.normalized.id], functions: [fnName], effectOrder: [] });
  }
  const entrySource = `function engineStep(frameworkCancellation) {\n  ${functions.map(({ name }) => `${name}();`).join('\n  ')}\n}\n`;
  const composerContributionIdentity = sourceIdentity(entrySource);
  const entryUnit = sourceUnit(packageId, 'composer-entry', entrySource, ['engineStep'], vectorRevision, composerContributionIdentity);
  sourceUnits.push(entryUnit);
  functions.push({ name: 'engineStep', executionRole: 'runtime-entry', parameters: [{ name: 'frameworkCancellation', type: 'sideband<host-to-device,u32>', sidebandRole: 'framework-cancellation' }], returns: 'void', sourceUnit: entryUnit.id, ownerProfile: packageId, semanticRole: `${packageId}.engine-step`, calls: functions.map(({ name }) => name), helpers: [] });
  programUnits.push({ id: `program-unit.${PROFILE}.entry`, kind: 'entry-point', surface: null, contributors: [packageId], functions: ['engineStep'], effectOrder: [] });

  const publicRequirements = [
    { contract: schemaReference('cuda-js.device-js'), consumers: [packageId], qualification: 'portable' },
    { contract: schemaReference('cuda-js.operation-lifecycle'), consumers: [packageId], qualification: 'native-compatible-pair' },
    { contract: schemaReference('cuda-js.publication-mailbox'), consumers: [progressResult.normalized.id], qualification: 'native-compatible-pair' },
  ];
  const profiles = ownerResults.map(profileReference).sort((a, b) => a.id.localeCompare(b.id));
  const semanticOwners = [packageId, ...ownerResults.map(({ normalized }) => normalized.id)].sort();
  const deletionRecords = semanticOwners.map((owner) => ({
    owner,
    sourceUnits: sourceUnits.filter(({ semanticOwner }) => semanticOwner === owner).map(({ id }) => id),
    functions: functions.filter((fn) => sourceUnits.find(({ id }) => id === fn.sourceUnit)?.semanticOwner === owner).map(({ name }) => name),
    resources: packageResources.filter(({ ownerProfile }) => ownerProfile === owner).map(({ id }) => id),
    publicRequirements: publicRequirements.filter(({ consumers }) => consumers.includes(owner)).map(({ contract }) => contract.id),
    sidebands: [cancellation].filter(({ semanticOwner }) => semanticOwner === owner).map(({ id }) => id),
    deliveries: [delivery].filter(({ semanticOwner }) => semanticOwner === owner).map(({ id }) => id),
    packageRecords: owner === packageId ? ['package.execution-operation'] : [],
  }));
  const profileTemplate = {
    schema: 'cuda-mcgs.program-package-profile/0.2.0', representation: REPRESENTATION, status: 'accepted', contract: catalogContract(authority, 'SPEC-0005'), id: packageId, version: VERSION,
    semanticEngine: { contractSet: { algorithm: authority.identities.contractSet.algorithm, sha256: authority.identities.contractSet.sha256 }, authority: { repository: MCGS_REPOSITORY, revision: mcgsRevision }, profiles, resourcePlan: profileReference(resourceResult), progressPlan: profileReference(progressResult), outputProfile: profileReference(outputResult), sessionProfile: { kind: 'absent' }, stageProfile: { kind: 'absent' }, channelProfile: { kind: 'absent' } },
    sourceUnits, functions, programUnits, publicRequirements, resources: packageResources, sidebands: [cancellation], deliveries: [delivery],
    operations: [{ id: `operation.${PROFILE}.engine`, entryPoint: 'engineStep', bindings: [{ parameter: 'frameworkCancellation', source: { kind: 'sideband', sideband: cancellation.id } }], grid: ['1', '1', '1'], block: ['1', '1', '1'], dynamicSharedBytes: '0', maxPending: '1' }],
    manifests: { result: schemaReference('vector.mcgs-external.package-result'), observation: schemaReference('vector.mcgs-external.package-observation'), diagnostic: schemaReference('vector.mcgs-external.package-diagnostic'), cancellation: schemaReference('vector.mcgs-external.package-cancellation'), completion: schemaReference('vector.mcgs-external.package-completion'), cleanup: schemaReference('vector.mcgs-external.package-cleanup') },
    provenance: { origin: 'first-party', trust: 'first-party-reviewed', revision: vectorRevision, license: 'GPL-3.0-or-later', review: schemaReference('vector.mcgs-external.package-review') },
    compatibility: { cudaJs: { repository: CUDA_JS_REPOSITORY, revision: CUDA_JS_REVISION, package: CUDA_JS_PACKAGE }, apiSchema: '1', capabilityNegotiation: 'pre-allocation-fail-closed', fallback: 'none', requiredEvidence: [schemaReference('vector.mcgs-external.public-composition-evidence')] },
    deletion: { selectedOwners: semanticOwners, records: deletionRecords, comparison: 'byte-exact-except-truthful-selected-owner-identities', absence: 'structural-omission-no-placeholder' },
  };
  return { profileTemplate, composerContributionIdentity };
}
