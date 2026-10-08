# LatticeKnight successor qualification implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this bounded task with TDD.

**Goal:** Materialize explicitly identified checkpoint 73091 and independent ONNX numerical references for later physical Tensor comparison.

**Architecture:** Keep the frozen 54499 fixture unchanged. Read the producer's stored ZIP tensor archive using its exact descriptor, and snapshot the producer's JavaScript feature adapter. Run official prebuilt ONNX Runtime only as an independent evidence provider through its JavaScript API.

**Tech stack:** Node.js, built-in Buffer/crypto/fs, onnxruntime-node 1.30.0.

**Spec:** `docs/specs/VECTOR-0002-native-boundary-and-js-only-implementation.md`; explicit owner instruction to complete the working CUDA.js package using judgment.

## Global constraints

- Maintained Vector source is JavaScript/TypeScript.
- Native evidence may be produced externally; Vector maintains no native source, builds, or bindings.
- Preserve frozen 54499 fixtures and verifiers; 73091 is an explicit successor candidate.
- All generated artifacts go to a new external evidence directory, never producer roots.
- Numerical parity remains unqualified until a separate physical Tensor comparison.

## Review focus

- Malformed/truncated ZIP offsets must fail before reading outside bounds.
- Duplicate storage entries, unsupported compression, CRC corruption, and overlapping ranges must fail.
- Descriptor insertion order must not change canonical storage order; missing/duplicate indices fail.
- Checkpoint, descriptor, ONNX, feature-adapter, and flat-parameter identity mismatches fail before writes.
- Wrong ONNX output shape/nonfinite values fail, and session cleanup always runs.

## Task 1: Explicit candidate extraction

Create `test/fixtures/model-successor/latticeknight-73091.json`, `tools/latticeknight-successor-candidate.mjs`, and its test file. Interface: `readStoredCheckpointZip(Buffer) -> Map`, `extractCheckpointParameters({checkpointBytes,descriptor,candidate}) -> {parameters,identity}`, and CLI `--checkpoint --descriptor --onnx --adapter --package --output`. Tests cover each ZIP/storage/identity failure above and literal tiny tensors in reversed descriptor order.

- [x] Write tests and run `node --test tools/latticeknight-successor-candidate.test.mjs`; observe missing-feature failures.
- [x] Implement extraction and exclusive new-directory materialization (candidate identity is written last); run tests green.
- [x] Materialize exact real 73091 candidate externally and record hashes.

## Task 2: Independent ONNX oracle

Create `tools/latticeknight-successor-oracle.mjs` and its test file. Interface: `runOracle({candidateDirectory,outputDirectory,runtimeModule})`; CLI `--candidate --output --runtime` requires the exact installed official ORT module path. Snapshot producer feature adapter is the sole encoding authority. Produce features, FP32 policy/value bytes and JSON identities for full two-item and partial one-item batches, plus release/cleanup receipt.

- [x] Test output shape/nonfinite failures and guaranteed session release against a bounded public runtime port.
- [x] Implement official runtime integration, pin exact package version, and run tests green.
- [x] Install official prebuilt package outside source using pinned registry integrity; measure real producer model.
- [x] Run repository verification and existing model tests with exact dependencies; commit bounded new files.

## Execution record

Baseline `node tools/verify-repository.mjs`: pass, 56 files. Native worktree tool cannot select this separate repository or the requested path; used explicit-path Git worktree on branch `codex/vector-model-parity-20261008` from `a977774305de1f113d01c23ba00504d00b1f5f9a`. Owner authorized inline implementation without another approval. Outputs retained as evidence for integration; worktree retained for root review.

Ruling: full batch uses two producer-encoded positions (starting position and black-to-move tactical position), and partial batch repeats full slot zero, preserving the existing occupancy comparison seam. Producer adapter emits a standard Array; an observed real-run failure established that boundary, and a failing regression test preceded the fix to accept Array/Float32Array and serialize finite FP32 values without encoding duplication.

Verification: 19 new tests and all 53 tool tests pass under Node 26.7.0 with exact Tensor revision `0da2c70a0a10df908a33e842aa4ba3dbd7605c48`; repository policy passes across 62 files. Official ORT 1.30.0 primary tagged documentation and registry version/integrity were checked, and installed with `--ignore-scripts` (Windows prebuilts already bundled). Runtime lock version/resolved/integrity are checked before loading.

Evidence root: `E:/uci-arena-task-builds/vector-model-parity-evidence-20261008`. `candidate-73091/` contains 14,551,952 parameter bytes plus exact descriptor, ONNX, and producer JS feature-adapter snapshots. `oracle-73091-measured/` contains full/partial feature and policy/value bytes, `reference.json`, and successful `cleanup.json` with one release attempt. `oracle-73091/cleanup.json` retains the initial adapter-boundary failure and successful release as superseded diagnostic evidence. `oracle-runtime/` retains locked official dependencies for reproducible oracle reruns. No background processes or product-native code were created. Physical Tensor parity remains pending and no frozen-fixture identity is changed.

## Physical qualification follow-up

Owner authorized `tools/latticeknight-physical-observation.mjs` and its tests to exercise exact Tensor alpha.7/CUDA-JS alpha.21 through public host-planned execution, strictly as qualification rather than an active engine inference profile. Installed local Tensor tarball SHA256 `7b9cdc84f2b6cb330d304a6052f56875d5372d63cfe9260f4b9a4e246360465d`. Exact Node 26.11.1 executable at the owner-supplied managed qualification path was used.

Three new tests pass: original tolerance/first-divergence reporting, nonfinite/length rejection, and unchanged full-model preflight. The 2216-node capacity-two program requires 48,914,008 material bytes; public whole-plan resolution fails before compiler/GPU work with `TENSOR_SIMT_BINDING_LIMIT`, maximum 64. Borrowed session/runtime cleanup is graceful and compiler programs created is zero. This routes a concrete generic host-plan realization gap to Tensor, without widening lower limits or changing mapper/math.

`physical-host-plan-preflight-73091-measured/observation.json` records a native public matmul preview on Node 26.11.1, output `[58,64,139,154]`, zero error, compiler/module/program identity and graceful cleanup. Its preceding failed preview receipt is retained as superseded diagnostic evidence: read-only preview input allocations were corrected to public read-write initialization authority; the model builder remained untouched.

Current full Vector tool suite with installed Tensor alpha.7: 55 pass, one historical exact-alpha.6 assertion fails (`root-public Tensor callable compilation owns exact item ABI and workspace`). That frozen test remains unchanged. All 22 new successor/oracle/physical-observation tests and repository policy pass. Product numerical comparison remains blocked at public full-plan admission and no model-parity or active-inference claim is made.

## Resident host numerical qualification

Root approved a separate, bounded Tensor-owned candidate execution profile after the exact prepared binding failure. Tensor alpha.8 package SHA256 `15f3ced369261d70c5e8c427040a598959b57005f1d9b058dff795b1af8b8e96` realizes the original graph through public `execution: 'resident-sequence'`, retaining 32 nodes/64 bindings per chunk. Original mapper source SHA256 remains `c6e9b74da76d4e7dff2a199a33f56954b0aadd26e328561fd317901e4c505116`.

Actual Node 26.11.1/Windows/compute_75 execution of checkpoint 73091 passed independent ONNX FP32 tolerances for both full and partial batches. Original program identity `tensor-program-v1:9c86369d3d79a69bff047f21ec888bdef62ec0aca4d99e4a9fd4cb92fa7dea04` and plan identity `tensor-plan-v1:22cccf180cd4c0f1cce6ff43d2a0a695884b54350c330a5a14fe606fccc9d9f0` remain unchanged. Resolution produces 2610 kernels, 1540 bindings, 17,475,040 workspace bytes and 82 bounded public prepared chunks. The static preflight admits 1340 materials/48,914,008 bytes plus 14,560,696 input bytes and a conservative 64 MiB workspace ceiling under 256 MiB/4096 Tensor limits. CUDA-JS public transfer/allocation policy selects 64 MiB; the earlier rejected 128 MiB transfer attempt is retained as superseded diagnostic evidence.

Full policy maximum absolute error `0.000011444091796875` against tolerance `0.0002`; full value `4.470348358154297e-8` against `0.00002`. Partial policy has the same maximum absolute error; partial value `2.60770320892334e-8`. Maximum relative errors are recorded separately and do not alter the original absolute gates. All first-divergence fields are null. Host partial input zero-pads its inactive capacity slot; this proves occupied output mathematics, not device inactive no-write guards.

Evidence: `physical-resident-model-73091-public-policy/observation.json`, SHA256 `4061f225d99e1a30ab7eb73bc92b44b1c1f72b980c9eafcfaea6b98c299ed0f5`, plus full/partial observed policy/value bytes and independent reference hashes. Compiler created/destroyed 82 programs; driver closed 5862 resources with zero live/orphaned; session reports zero tensors/bytes/resolved plans and graceful terminal state. All 23 new tool tests and repository policy pass. Frozen alpha.6 tests are retained for their historical provider context; current host numerical qualification does not promote an active device-closed engine inference/search pipeline or performance claim.
