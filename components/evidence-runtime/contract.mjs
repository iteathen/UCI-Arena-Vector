/** Public packaging port. Inventory is supplied by the immutable artifact owner. */
export function buildRuntimeContract({componentVersion,targetTriple}) {
  if(!/^\d+\.\d+\.\d+(?:[-.][A-Za-z0-9.-]+)?$/u.test(componentVersion??'')
    ||!['windows-x86_64','linux-x86_64'].includes(targetTriple))throw new Error('invalid runtime packaging identity');
  const capability={status:'available',entrypoint:'components/evidence-runtime/cli.mjs',request_schema:'uci_arena_evidence_request_v2',output_schema:'uci_arena_evidence_result_v2'};
  return {schema:'uci_arena_evidence_runtime_v2',component_id:'uci_arena.vector',component_version:componentVersion,target_triple:targetTriple,
    runtime_identity:{path:'contracts/runtime-identity.json',schema:'vector_engine_runtime_identity_v1'},referee:'components/evidence-runtime/referee.mjs',
    resource_requirements:{gpu:true},
    capabilities:{complete_game:{...capability},paired_sprt:{...capability},timing_profile:{...capability}},
    campaigns:[{name:'managed-uci-measurements',parameters_schema:'components/evidence-runtime/parameters.schema.json',workloads:['complete_game','paired_sprt','timing_profile']}]};
}
