# Signed atomic Vector component delivery

**Status:** Implemented candidate; portable qualification only. No release or
dispatch was performed; final integration remains root-owned.

Owner task: add the missing signed delivery envelope around the existing atomic
component packager, without changing engine, timing, native qualification or
Installer semantics. Exact starting source is
`7ee68311238fe77819cb93456b30dc458d0f7246`. This isolated branch owns only the
new release helper, manual release workflow and focused tests/documentation.

Authority: accepted VECTOR-0002; the complete cuda-js suite plan; existing
`tools/component-package.mjs`; Installer `installation_contract_v1.yaml`
provider-candidate provenance and atomic component manifest contracts. Installer
retains suite selection, deployment and recovery. No native source/build,
private library interface, search fallback or per-file installer GUID is added.

## Selected boundary

1. The hardware owner constructs one complete locally qualified atomic tar.gz
   using the existing packager. Its acceptance receipt must pass all five
   existing gates: gpu-search, legal-game, clock-safety, lifecycle and
   tactical-safety. Every runtime file and source/library/model identity remains
   bound to that receipt. The release helper never creates a native pass receipt.
2. A manual protected-main workflow receives the exact archive from one
   digest-bound same-repository **draft** intake release asset targeting the full
   source SHA. Vector currently has no registered self-hosted runner, and an
   ordinary local API token cannot create a workflow artifact. It does not
   rebuild, install dependencies or requalify model
   mathematics on a hosted machine. The intake source commit must match the
   protected checkout and `closure.vector_commit`.
3. `tools/release-stage.mjs` safely extracts bounded producer ustar data into an
   isolated temporary directory and calls `verifyAtomicComponent`. It validates
   source cleanliness and declared qualification/license identities, then emits
   the existing Installer `arena_provider_release_result_v1` and exact in-toto
   provider statement for the unchanged input archive.
4. The workflow signs that statement with pinned Cosign 3.0.6, verifies exact
   certificate/issuer/repository/source/workflow/ref/trigger and archive identity,
   and compares the verified full DSSE payload to the complete provider result.
   Only archive, provider result and Sigstore bundle form the candidate. An
   existing release tag is rejected; the output remains a draft prerelease in
   the actual public Vector repository until root's complete review. Repository
   visibility is recorded from read-only metadata, never inferred as private.

## Files and verification

- `tools/release-stage.mjs`: bounded archive intake, existing owner validation,
  immutable source/qualification/license binding, atomic staged provider files,
  in-toto statement and verified full-predicate comparison.
- `.github/workflows/component-release.yml`: manual intake and protected source
  fence, exact archive signing/verification and explicit candidate publication.
- `test/release-stage.test.mjs`: metadata-only fixtures and source/artifact/
  qualification/license/substitution/unsafe-archive/partial-output falsifiers.
  These fixtures establish packaging behavior, never native qualification.
- This document: ownership, exact inputs, prerequisites and scoped claims.

## Exact intake and license envelope

The owner prepares a draft intake release tagged
`qualification/vector/v<VERSION>/<FULL_SOURCE_SHA>` targeting that exact full
SHA, with exactly one asset named
`uci_arena.vector-<VERSION>-windows-x86_64.tar.gz`. The asset's API digest and
downloaded bytes must match the explicitly supplied SHA256. The final signed
candidate uses a separate `component/uci-arena-vector/v<VERSION>/windows-x86_64`
tag and stays draft. Existing candidate tags are never edited or overwritten.

Before native qualification, the runtime closure includes
`contracts/release-license-inventory.json` with schema
`vector_release_license_inventory_v1` and six `materials`: `vector`, `node`,
`cuda-js`, `cuda-mcgs`, `cuda-js-tensor`, `model`. Each material has `id`,
`subject`, `license_expression`, `license_paths`, `source_offer`.
`license_paths` name existing inventoried nonempty files under `licenses/`;
all required upstream/transitive notices can be listed together in each role.
Subject bindings are `{commit}` for Vector, `{version,sha256}` for Node,
`{commit,version}` for each public library, and
`{checkpoint_sha256,parameters_sha256}` for the model. These values come from the
existing runtime closure and actual binary inventory; library declarations
must match the exact package metadata. The helper copies no license from an
unqualified location and assigns no new permissions.

The provider result retains the derived SPDX package document and notice
identity in its signed `validation_evidence`; `sbom_sha256` and
`licenses_sha256` hash those exact derived documents. No extra payload file is
added after qualification, and no separately authored per-file GUID is needed.
Stage output contains the unchanged archive, provider result, and a bounded
internal statement. Cosign adds the bundle; only the three standard candidate
files are uploaded to the output draft.

Baseline package/Installer tests passed 15/15. New tests observed missing helper
and workflow failures before implementation, and a source-output alias falsifier
observed RED with lexical placement then GREEN with canonical placement. Nine
new portable cases pass. Final Node26.7/26.11 replay passes all 24 tests on each
runtime; repository policy, syntax, unique-key YAML parsing and diff checks pass.
An external metadata-only capsule also passed the Installer's public
`verifyGitHubProviderCandidate` full-shape/predicate admission using an explicit
mock cryptography port, and rejected malformed shape. This establishes contract
compatibility only. Actual OIDC/signature verification remains undispatched.
No release, merge, workflow dispatch, installation or model publication occurs.

Follow-up cleanup review: both recursive temporary removals now check the
resolved absolute target against the original canonical parent, generated name,
and exact directory incarnation before deletion. Junctions, moved/replaced
directories and changed parent resolution fail closed and retain the disputed
path. A successful atomic output rename relinquishes staging cleanup ownership.
Two substitution falsifiers observed RED before the repair, then GREEN; a third
case covers failed staging cleanup. All27 release/packaging tests pass on
Node26.7 and26.11, including preserved unowned files. These remain portable
metadata/containment tests, not actual signing or engine qualification.

## Release prerequisites

The final hardware-qualified complete payload/receipt does not exist at this
starting source. Clock policy and actual hardware acceptance remain root-owned.
Restaurant's current README supplies an AGPL-3.0-or-later producer notice and
copyright 2023–2026 Josh Y Oshiro. The model is user-owned training output from
run `1784364601_12348`; no separate checkpoint license clause was identified.
These actual producer notices and exact provenance must enter the payload;
the helper does not invent permissions or require a new human approval ritual.
Release must retain actual license/source-offer material for Vector, Node, the
three public libraries and the model; no license permission is inferred from
having a checkpoint or from successful qualification. The immutable upload
transport and final license/source-offer evidence need owner reconciliation
before any upload or dispatch. The helper's license inventory only binds
provided notices to exact materials; it does not interpret legal rights.
