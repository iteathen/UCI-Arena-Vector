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
