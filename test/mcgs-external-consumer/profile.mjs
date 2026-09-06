import { CUDA_JS_PACKAGE, CUDA_JS_REVISION, PROFILE, REPRESENTATION, VERSION, withSchema } from './shared.mjs';
import { buildDomainInput, buildGraphInput } from './domain.mjs';
import { buildPolicyInput } from './policy.mjs';
import { buildResourceInput } from './resource.mjs';
import { buildProgressInput } from './progress.mjs';
import { buildOutputInput } from './output.mjs';
import { buildPackageProfile } from './package.mjs';

export function buildExternalConsumerComposition({ compiler, library, authority, schemaShas, vectorRevision, mcgsRevision }) {
  const sources = {
    domain: 'function domainStep() { return 0; }\n',
    policy: 'function policyStep() { return 0; }\n',
    resource: 'function resourceStep() { return 0; }\n',
    progress: 'function progressStep() { return 0; }\n',
    output: 'function outputStep() { return 0; }\n',
  };
  const domain = withSchema(compiler.normalizeDomainProfile(buildDomainInput(authority, vectorRevision, sources.domain), authority), schemaShas.domain);
  const graph = withSchema(compiler.normalizeGraphProfile(buildGraphInput(authority, domain), authority, domain), schemaShas.graph);
  const policy = withSchema(compiler.normalizePolicyProfile(buildPolicyInput(authority, vectorRevision, domain, graph, sources.policy), authority, domain, graph), schemaShas.policy);
  const resourceKnown = [domain, graph, policy];
  const resource = withSchema(compiler.normalizeResourceProfile(buildResourceInput(authority, vectorRevision, domain, graph, policy, schemaShas, sources.resource), authority, resourceKnown), schemaShas.resource);
  const progress = withSchema(compiler.normalizeProgressProfile(buildProgressInput(authority, vectorRevision, resource, sources.progress), authority, resource, resourceKnown), schemaShas.progress);
  const output = withSchema(compiler.normalizeOutputProfile(buildOutputInput(authority, vectorRevision, resource, progress, sources.output), authority, resource, progress), schemaShas.output);
  const ownerResults = [domain, graph, policy, resource, progress, output];
  const sourceByOwner = {
    [domain.normalized.id]: sources.domain,
    [policy.normalized.id]: sources.policy,
    [resource.normalized.id]: sources.resource,
    [progress.normalized.id]: sources.progress,
    [output.normalized.id]: sources.output,
  };
  const builtPackage = buildPackageProfile(authority, mcgsRevision, vectorRevision, ownerResults, sourceByOwner);
  const generator = { id: 'composer.vector-external-consumer', version: VERSION, revision: vectorRevision, language: 'restricted-device-js', canonicalization: 'utf8-lf-source-units-by-js-code-unit-v1', maxSourceBytes: '262144', maxFunctions: '64', maxCallDepth: '16' };
  const resolved = library.resolve(builtPackage.profileTemplate, generator);
  const context = compiler.createProgramPackageCompositionContext(resolved.normalized, {
    profileResults: ownerResults,
    resourceResult: resource,
    progressResult: progress,
    outputResult: output,
    sessionResult: null,
    stageResult: null,
    channelResult: null,
    composerContributionIdentity: builtPackage.composerContributionIdentity,
  });
  return { ownerResults, domain, graph, policy, resource, progress, output, profileTemplate: builtPackage.profileTemplate, generator, resolved, context };
}

export const externalConsumerConstants = Object.freeze({ profile: PROFILE, representation: REPRESENTATION, cudaJsRevision: CUDA_JS_REVISION, cudaJsPackage: CUDA_JS_PACKAGE });
