# UCI Arena Vector Status

**Updated:** 2026-08-26  
**Phase:** specification and connector planning  
**Production implementation:** not yet authorized

## Product identity

- Product: **UCI Arena Vector**
- Repository: `iteathen/UCI-Arena-Vector`
- Intended executable stem: `uci_arena_vector`
- Product role: independent GPU-resident UCI chess engine for the UCI Arena suite

## Architecture state

Selected initial host architecture:

- Node.js product/composition/UCI layer;
- restricted Device-JS chess/search/evaluator product modules;
- `cuda-mcgs` universal search framework;
- `cuda-js-tensor` dense evaluator mathematics;
- `cuda-js` CUDA runtime/toolchain;
- no Vector-maintained native source.

This avoids a native-to-Node search bridge. The existing `uci-arena-engine` is an independent product/reference oracle, not a runtime dependency.

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

### CUDA-JS

Current package baseline recorded by the CUDA-MCGS/Tensor handoff is `cuda-js@0.1.0-alpha.16` at protected `main@4971302cfb48431c0843126a59d5884d84a81641`.

No new generic CUDA-JS mechanism is currently proven necessary for Vector's first functional search profile. Any discovered native-mechanism need must be filed there rather than implemented locally.

### CUDA-JS-Tensor

`cuda-js-tensor@0.1.0-alpha.6` / SPEC-0009 provides an item-parallel device-callable Tensor mechanism. Tensor issue #22 tracks CUDA-MCGS consumer qualification.

Result arena, typed/strided-batched cuBLASLt, lower precision, Tensor Cores and fusion providers are optimization lanes, not current correctness blockers.

## Confirmed connector gaps

1. **CUDA-MCGS -> CUDA-JS runtime adapter** is planned but not implemented (#125).
2. **CUDA-MCGS evaluator -> Tensor connector** is planned but not implemented (#124).
3. **Vector chess Domain/Policy Device-JS specialization** does not yet exist.
4. **Vector model -> Tensor adapter** does not yet exist.
5. **Book Forge consumer compatibility is over-coupled:** current public output schema hard-codes `consumer_component_id: uci_arena.engine`; Vector must not impersonate that product.
6. **Vector timing-policy consumer/application adapter** does not yet exist; no Evidence Service implementation gap has yet been proven.
7. **Vector tablebase adapter** does not yet exist. Root-level exact authority is required first; internal CPU callback from device search is forbidden.
8. **Vector component/release/Installer/Manager integration** does not yet exist.

## Current next action

Freeze Vector's foundational contracts and create the P0 connector issue train. Start only work that is independent of unfinished CUDA-MCGS semantic acceptance: product contract/specification, chess reference fixtures, external producer compatibility correction, and adapter boundary design.

Do **not** implement production CUDA-MCGS search lowering before #122 accepts the universal semantic packet.

## Hard stop conditions

Stop and revise the plan if:

- a Vector change appears to require native code;
- a sibling repository's private source/type is needed;
- a CUDA library must learn chess/UCI/book/timing/tablebase/model-head semantics;
- active search needs a CPU-produced intermediate;
- a producer contract requires Vector to impersonate another component identity;
- a first-profile optimization becomes a de facto correctness dependency without evidence.
