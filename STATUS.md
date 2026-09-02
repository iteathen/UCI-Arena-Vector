# UCI Arena Vector Status

**Updated:** 2026-09-01
**Phase:** specification/reference and connector planning  
**Current focus:** issue #2 — chess Domain/Policy contract + independent oracle  
**Production CUDA-MCGS lowering:** blocked on CUDA-MCGS #122

## Product identity

- Product: **UCI Arena Vector**
- Repository: `iteathen/UCI-Arena-Vector`
- Intended executable stem: `uci_arena_vector`
- Product role: independent GPU-resident UCI chess engine for the UCI Arena suite
- Parent plan: #1

## Architecture state

Selected initial host architecture:

- Node.js product/composition/UCI layer;
- restricted Device-JS chess/search/evaluator product modules;
- `cuda-mcgs` universal search framework;
- `cuda-js-tensor` dense evaluator mathematics;
- `cuda-js` CUDA runtime/toolchain;
- no Vector-maintained native source.

This deliberately avoids a native-to-Node search bridge. The existing `uci-arena-engine` and Restaurant training/runtime code are independent references/producers, not Vector runtime dependencies.

The hard architectural diagnostic is explicit in `AGENTS.md`: **if Vector appears to need native code, that is evidence of missing reusable library/boundary coverage and must be classified before implementation.**

## Upstream dependency state

### CUDA-MCGS

Current P0 dependency chain remains:

1. #36 complete universal reference/conformance;
2. #122 integrated semantic acceptance;
3. #125 public CUDA-JS runtime adapter;
4. #124 public CUDA-JS-Tensor evaluator connector;
5. #37 bounded parallel native qualification;
6. CUDA-JS #32 exact compatible pair;
7. #123 external-consumer embedding readiness.

Production Vector search/evaluator integration remains blocked until those owning library gates are accepted and qualified.

### CUDA-JS

Vector still requires only public CUDA-JS contracts. Any newly discovered generic CUDA/native mechanism need routes there rather than into Vector. No private CUDA-JS source or native Vector mechanism is authorized.

### CUDA-JS-Tensor

Current protected provider assessed by the first-real-model gate:

`cuda-js-tensor@0.1.0-alpha.6@44376e151ab854c81d65df79db1717478ae8ce5b`

Tensor issue #22 tracks CUDA-MCGS/Vector consumer qualification. First-real-model coverage has now falsified the earlier synthetic assumption that no additional dense primitive is required: generic Tensor owner issue **#32** records the exact missing semantics `unary:erf`, bounded indexed `gather`, and finite ordered `concat`.

These are correctness capabilities, not optimization requests. Result arena, typed/strided-batched cuBLASLt, lower precision, Tensor Cores and fusion providers remain later optimization lanes.

## First real model coverage — Vector #3

The first real model is now durably frozen at the contract/evidence layer on PR #16 / branch `model/3-latticeknight-real-coverage`.

Frozen model identity:

- model: LatticeKnight-4M / `compact_chessformer_gab_v1`;
- source repository/revision: `iteathen/the_restaurant@8c7d75672cee36aa2a39fbddf713041552770b22`;
- package path: `model_packages/compact_chessformer_gab_v1.json`;
- package Git blob: `326ba7dd0584438a911baf5051e5f1bedd831274`;
- model spec: `specs/compact_chessformer_gab_v1.yaml`;
- stable run/checkpoint: `run_1784364601_12348`, batch `54499`;
- checkpoint SHA-256: `62dec13c22a4414db6b78ea9b6ca76bcf6f29a16a963c01d13d947d158b09c7e`;
- declarative checkpoint layout: 227 tensors, 3,637,988 f32 parameters, 14,551,952 parameter bytes;
- first correctness input: `[1,17,8,8]` f32 = 4,352 bytes/item;
- outputs: `[1,4162]` policy plus `[1,1]` value = 16,652 bytes/item.

Evidence commit `f39cc8575da509f7365b70d74f67c11f24d502bb` is green in Model Tensor Coverage run `33575101719` and Repository quality run `33575101751`. The permanent verifier has 13/13 tests and reports:

`frozen_real_model_capability_gap`

with exactly:

- `concat` — unavailable operation kind;
- `gather` — unavailable operation kind;
- `unary:erf` — unavailable unary operator.

Real-model readiness is intentionally **false**. `--require-real` fails closed with `VECTOR_MODEL_TENSOR_CAPABILITY_GAP`. A falsifier that temporarily supplies those three capabilities proves the next gate becomes `VECTOR_MODEL_WORKSPACE_UNRESOLVED`; therefore closing #32 cannot accidentally promote the model before a complete TensorProgram/TensorPlan and workspace bound exist.

No Restaurant runtime/native code is imported. Only immutable producer provenance and declarative model/checkpoint facts are frozen.

## Vector issue train

### P0

- #2 — chess Domain/Policy specialization and independent differential oracle.
- #3 — model package -> CUDA-JS-Tensor evaluator adapter; real model frozen, correctness mapping blocked on Tensor #32 and production integration blocked on CUDA-MCGS #122/#124.
- #4 — UCI lifecycle -> CUDA-MCGS Search Session mapping.
- #5 — Book Forge opening-book consumer adapter.
- #6 — Timing Evidence policy + live-clock consumer adapter.
- #7 — endgame tablebase integration + reusable library coverage assessment.

### P1

- #8 — component/release/Manager/Installer/UCI-consumer integration.

## Confirmed external connector gaps

### Book Forge

Current Book Forge public output hard-codes `consumer_component_id: uci_arena.engine`. Vector must not impersonate that product.

- Owner issue: `iteathen/uci-arena-book-forge#35`.
- Vector consumer: #5.

### Timing Evidence

No producer defect is currently proven. Evidence target identity is already expressed through exact engine/model/provider facts rather than one engine component id.

- Population-policy publication owner: `iteathen/uci-arena-evidence-service#46`.
- Vector consumer/application: #6.

### Tablebases

No reusable Node-compatible tablebase library has yet been identified. Vector #7 owns the coverage assessment.

If the only implementation path appears to be a native Fathom/Syzygy addon inside Vector, stop: create/extract a reusable library/contract instead. Product-specific WDL/DTZ/history/rule-50 semantics stay in Vector; only reusable mechanism belongs in a library.

### Installer / suite topology

Installer's canonical architecture still describes six products and one engine brick. Vector is a seventh independent product and must coexist without adopting `uci_arena.engine` identity.

- Owner issue: `iteathen/uci-arena-installer#186`.
- Vector release integration: #8.

## Current next action

Continue issue #2 at the **contract/reference level only**:

1. define exact packed state/action/history/value domains and units;
2. define state/transposition/history identity and root restriction semantics;
3. define independently replaceable Domain vs Policy/output responsibilities;
4. assemble a reproducible differential fixture/oracle corpus covering legal moves, transitions, draw/terminal rules, castling, en-passant, promotions and history collisions;
5. assess restricted Device-JS expressibility and file any genuinely generic library gap before implementation.

Parallel issue #3 work is now limited to preserving the frozen model contract, coordinating Tensor #32, and preparing the exact TensorProgram mapping once the generic capability owner is accepted. Do not implement a local gather/concat/GELU workaround.

Do **not** implement production CUDA-MCGS search lowering before #122 accepts the universal semantic packet.

## Hard stop conditions

Stop and revise the plan if:

- a Vector change appears to require native code;
- a sibling repository's private source/type is needed;
- a CUDA library must learn chess/UCI/book/timing/tablebase/model-head semantics;
- active search needs a CPU-produced intermediate;
- exact model math would be changed merely to fit an existing library surface;
- a producer contract requires Vector to impersonate another component identity;
- a first-profile optimization becomes a de facto correctness dependency without evidence;
- an external product-specific need is being mislabeled as a universal library primitive merely to avoid a proper product adapter.
