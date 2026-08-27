# UCI Arena Vector Status

**Updated:** 2026-08-26  
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

This deliberately avoids a native-to-Node search bridge. The existing `uci-arena-engine` is an independent product/reference oracle, not a runtime dependency.

The hard architectural diagnostic is now explicit in `AGENTS.md`: **if Vector appears to need native code, that is evidence of missing reusable library/boundary coverage and must be classified before implementation.**

## Upstream dependency state

### CUDA-MCGS

Current P0 dependency chain:

1. #113 root/advance/reroot/attention reconciliation;
2. #36 complete universal reference/conformance;
3. #122 integrated semantic acceptance;
4. #125 public CUDA-JS runtime adapter;
5. #124 public CUDA-JS-Tensor evaluator connector;
6. #37 bounded parallel native qualification;
7. CUDA-JS #32 exact compatible pair;
8. #123 external-consumer embedding readiness.

Open architecture/control PR: CUDA-MCGS #126.

### CUDA-JS

Current package baseline recorded by the CUDA-MCGS/Tensor handoff is `cuda-js@0.1.0-alpha.16` at protected `main@4971302cfb48431c0843126a59d5884d84a81641`.

No new generic CUDA-JS mechanism is currently proven necessary for Vector's first functional search profile. Any discovered generic CUDA/native-mechanism need routes there rather than into Vector.

Open control-state PR: CUDA-JS #151.

### CUDA-JS-Tensor

`cuda-js-tensor@0.1.0-alpha.6` / SPEC-0009 provides an item-parallel device-callable Tensor mechanism. Tensor issue #22 tracks CUDA-MCGS/Vector consumer qualification.

Open priority PR: CUDA-JS-Tensor #26.

Result arena, typed/strided-batched cuBLASLt, lower precision, Tensor Cores and fusion providers are optimization lanes, not current correctness blockers.

## Vector issue train

### P0

- #2 — chess Domain/Policy specialization and independent differential oracle.
- #3 — model package -> CUDA-JS-Tensor evaluator adapter.
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

Execute issue #2 at the **contract/reference level only**:

1. define exact packed state/action/history/value domains and units;
2. define state/transposition/history identity and root restriction semantics;
3. define independently replaceable Domain vs Policy/output responsibilities;
4. assemble a reproducible differential fixture/oracle corpus covering legal moves, transitions, draw/terminal rules, castling, en-passant, promotions and history collisions;
5. assess restricted Device-JS expressibility and file any genuinely generic library gap before implementation.

Parallel dependency-safe work is allowed on #3, #4, #6, #7 and #8 at the specification/contract level. #5 is blocked on Book Forge #35 for final public contract.

Do **not** implement production CUDA-MCGS search lowering before #122 accepts the universal semantic packet.

## Hard stop conditions

Stop and revise the plan if:

- a Vector change appears to require native code;
- a sibling repository's private source/type is needed;
- a CUDA library must learn chess/UCI/book/timing/tablebase/model-head semantics;
- active search needs a CPU-produced intermediate;
- a producer contract requires Vector to impersonate another component identity;
- a first-profile optimization becomes a de facto correctness dependency without evidence;
- an external product-specific need is being mislabeled as a universal library primitive merely to avoid a proper product adapter.
