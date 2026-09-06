# UCI Arena Vector Status

**Updated:** 2026-09-05
**Phase:** first-real-model public-library coverage and external-consumer preparation
**Current focus:** issue #3 — Tensor #61 handoff, then exact LatticeKnight TensorProgram/TensorPlan workspace and oracle
**Parallel public-package falsifier:** CUDA-MCGS #123 evaluator-free/CUDA-free external consumer

## Product identity

- Product: **UCI Arena Vector**
- Repository: `iteathen/UCI-Arena-Vector`
- Intended executable stem: `uci_arena_vector`
- Product role: independent GPU-resident UCI chess engine for the UCI Arena suite
- Parent plan: #1

Vector remains a product layer. Chess, UCI, concrete model/package/head meaning, opening-book use, timing application and tablebase policy stay here. CUDA-MCGS, CUDA-JS-Tensor and CUDA-JS are consumed only through public contracts. Vector production gets no C/C++/CUDA/PTX/native-FFI escape path.

## Current upstream state

### CUDA-MCGS

Protected semantic/runtime foundations required by Vector are complete:

- #122 integrated search/evaluator semantic acceptance — complete;
- #109 public package/interface baseline — complete;
- #125 public CUDA-JS runtime adapter — complete;
- #123 external evaluator-free public-package consumer falsifier — current parallel consumer lane;
- #124 Tensor evaluator request/batch/scatter/publication connector — open and downstream of the real-model public coverage facts.

CUDA-MCGS protected #228 also reconciles its public CUDA-JS adapter with the current publication/header-profile, operation-capacity, public-kernel identity and bound-resource mechanics. That is framework/runtime-adapter maintenance, not a change in Vector product semantics. Physical CUDA-MCGS/CUDA-JS support remains a separate hardware evidence gate and is not implied by portable consumer work.

### CUDA-JS

The Tensor package currently integrated before tanh implementation still consumes `cuda-js@0.1.0-alpha.18@30d11a5d38dd7b9987bc8bac4ac67c2fcf8fee60`.

The missing lower scalar mechanism is no longer open: CUDA-JS protected-integrated `SPEC-0030-tanh-v1` at `d1a8edef5bd06c402a5c14c8945269f206520174`, reviewed tree `4e71779e19132fedbaa60bacee7db84b0692e1ae`, exposing public same-kind f32/f64 `gpu.math.tanh`. That lower result is portable/software/package capability; it does not promote native/provider support.

No additional generic CUDA mechanism is currently demonstrated by the Vector model coverage campaign. Physical/native support issues remain evidence-gated.

### CUDA-JS-Tensor

The frozen Vector verifier snapshot remains bound to the pre-tanh implementation baseline:

`cuda-js-tensor@0.1.0-alpha.6@62cc5f1076766219fc6e3561eee86cdd66803813`

Protected Tensor capability foundations on the first evaluator path are complete:

- #32 ordinary SPEC-0010 `unary:erf`, bounded static gather and ordered concat;
- #52 device-callable f32/f64 `unary:erf`;
- #37 device-callable non-axis-0 static gather/ordered concat child.

Tensor has now also accepted the consumer-backed additive `SPEC-0011` f32/f64 `unary:tanh` semantic child at protected merge `3f34e3153b75e5059a6473ee52c95c7b662a62ed`. Tensor #61 owns implementation/evidence through the protected public CUDA-JS `gpu.math.tanh` lower mechanism. Until #61 is protected-qualified and Vector refreshes its exact capability snapshot, the current real-model verifier must continue to fail closed on tanh rather than pretending accepted authority is implemented capability.

Tensor #22 remains the cross-repository real-model readiness outcome.

## First real model coverage — Vector #3

The first model remains durably frozen from the qualified evidence packet:

- model: LatticeKnight-4M / `compact_chessformer_gab_v1`;
- producer: `iteathen/the_restaurant@8c7d75672cee36aa2a39fbddf713041552770b22`;
- package: `model_packages/compact_chessformer_gab_v1.json`;
- package Git blob: `326ba7dd0584438a911baf5051e5f1bedd831274`;
- spec: `specs/compact_chessformer_gab_v1.yaml`;
- run/checkpoint: `run_1784364601_12348`, batch `54499`;
- checkpoint SHA-256: `62dec13c22a4414db6b78ea9b6ca76bcf6f29a16a963c01d13d947d158b09c7e`;
- 227 tensors / 3,637,988 f32 parameters / 14,551,952 parameter bytes;
- input `[1,17,8,8]` f32 = 4,352 bytes/item;
- outputs `[1,4162]` policy + `[1,1]` value = 16,652 bytes/item.

Protected reassessment found one correctness omission in the older coverage packet: the frozen value head is `[mean_pool, layer_norm, linear 256->128, relu, linear 128->1, tanh]`, but the old operation inventory did not include its final `tanh`.

The currently frozen implementation capability projection therefore distinguishes exact TensorProgram identities:

- base: `SPEC-0004-tensor-program-v1`;
- extension: `SPEC-0004-tensor-program-v1+SPEC-0010-erf-gather-concat-v1`.

`erf`, `gather` and `concat` are covered by protected public Tensor implementation. `unary:tanh` is no longer an ownership/design unknown: CUDA-JS supplies the lower Device-JS mechanism and Tensor has accepted the exact semantic child. The remaining dependency is Tensor #61 implementation/evidence. Vector must not locally approximate, expand `tanh` algebraically, or pre-claim the accepted Tensor child as implemented.

When #61 is protected-qualified, Vector #3 should refresh its exact Tensor capability snapshot first. The already-demonstrated next gate is then the complete static f32 TensorProgram/TensorPlan plus exact workspace/resource bound. Numerical parity against the frozen checkpoint remains separately required before evaluator readiness.

No Restaurant runtime/native source is imported; only immutable producer provenance and declarative architecture/checkpoint facts are evidence inputs.

## Current priority order

1. **#3 correctness/coverage:** consume the protected Tensor #61 result when available, refresh the exact capability snapshot, then build/freeze the complete f32 TensorProgram/TensorPlan and workspace/resource bound and run the independent oracle campaign.
2. **CUDA-MCGS #123 parallel consumer falsifier:** prove Vector can consume the exact public `cuda-mcgs` package in an evaluator-free/CUDA-free pre-ignition slice without private imports. This work does not depend on Tensor #61.
3. **Tensor #22 / CUDA-MCGS #124:** once model callable/resource facts are complete, connect evaluator request identity/batching/scatter/publication through public Tensor/CUDA-JS only.
4. **#2 / #4 product correctness:** chess Domain/Policy oracle and UCI/Search-Session adapter on the already accepted MCGS semantics.
5. Book/timing/tablebase/release integration after their producer/public-contract gates.
6. Native/platform/performance/strength work only after exact correctness/library coverage and physical evidence exist.

`cuda-nn` remains optional. Its #2 justification gate must compare direct Vector -> Tensor composition with a reusable NN layer after this concrete model mapping is explicit; the existence of the repository does not force Vector adoption.

## Hard stop conditions

Stop and route rather than work around if:

- exact model math would be changed merely to fit an existing library surface;
- a generic Tensor mathematical/item capability is missing;
- a generic CUDA compiler/runtime/provider mechanism is missing;
- a private sibling source/type or native Vector path seems necessary;
- active search would need a CPU-produced intermediate;
- CUDA libraries would need chess/UCI/model-head/book/timing/tablebase semantics;
- accepted-but-unimplemented authority is being reported as implemented capability;
- portable evidence is being used to claim physical/native support.
