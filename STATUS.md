# UCI Arena Vector Status

**Updated:** 2026-09-05
**Phase:** first-real-model FP32 qualification-candidate TensorProgram/TensorPlan workspace and oracle qualification
**Current focus:** issue #3 — construct the exact frozen LatticeKnight FP32 TensorProgram/TensorPlan, workspace/resource facts and independent oracle evidence
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

The exact CUDA-JS lower peer selected by the protected Tensor implementation is now:

`cuda-js@0.1.0-alpha.18@d1a8edef5bd06c402a5c14c8945269f206520174`

That protected revision supplies accepted/implemented public same-kind f32/f64 `SPEC-0030-tanh-v1` through `gpu.math.tanh`, reviewed tree `4e71779e19132fedbaa60bacee7db84b0692e1ae`. This is portable/software/package capability only; it does not promote native/provider or physical NVIDIA support.

No additional generic CUDA mechanism is currently demonstrated by the Vector model coverage campaign. Physical/native support issues remain evidence-gated.

### CUDA-JS-Tensor

The protected current Vector capability projection is bound exactly to:

`cuda-js-tensor@0.1.0-alpha.6@3a62bc47017aa10198eb1640b66f6b71a608b562`

Protected Tensor foundations on the first evaluator path are complete:

- #32 ordinary SPEC-0010 `unary:erf`, bounded static gather and ordered concat;
- #52 device-callable f32/f64 `unary:erf`;
- #37 device-callable non-axis-0 static gather/ordered concat child;
- #61 accepted/implemented f32/f64 SPEC-0011 `unary:tanh` through public CUDA-JS, protected merge `3a62bc47017aa10198eb1640b66f6b71a608b562`, tree `6b8ca9dd802c0f24f93b8cf612d8ba576e932857`, protected post-merge verify `34012270778` success.

Tensor #22 remains the cross-repository owner of the resulting generic real-model TensorProgram/TensorPlan coverage, workspace/resource, callable and oracle-boundary facts. Vector retains the concrete model/package/checkpoint/head/precision and product-oracle meaning.

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

Protected reassessment had found one correctness omission in the older coverage packet: the frozen value head is `[mean_pool, layer_norm, linear 256->128, relu, linear 128->1, tanh]`, but the old operation inventory did not include its final `tanh`. That omission is now closed for the current f32 semantic projection by protected exact-pair coverage rather than a local approximation.

Vector capability snapshot v3 preserves v1/v2 as historical evidence and models all four exact current TensorProgram contract states:

- base: `SPEC-0004-tensor-program-v1`;
- SPEC-0010 only: `SPEC-0004-tensor-program-v1+SPEC-0010-erf-gather-concat-v1`;
- SPEC-0011 only: `SPEC-0004-tensor-program-v1+SPEC-0011-tanh-v1`;
- mixed: `SPEC-0004-tensor-program-v1+SPEC-0010-erf-gather-concat-v1+SPEC-0011-tanh-v1`.

The canonical child order is SPEC-0010 then SPEC-0011. The frozen LatticeKnight operation-kind inventory selects the mixed contract exactly, and the current coarse f32 coverage projection reports `missing_capabilities: []`. This is not a claim that every listed operator is available at every Tensor dtype: SPEC-0010 `erf` and SPEC-0011 `tanh` remain f32/f64 only.

Protected Vector #3 / PR #19 integrated the exact Tensor-pair capability projection at merge `3d1ae4a00a601259a7ea0a1cd6b8a485132ca459`, tree `8014741e58a643010e008faca81a9d59aeac5b51`. Protected `Repository quality` run `34012907270` and protected `Model Tensor Coverage` run `34012907280` both succeeded. That coarse verifier demonstrated `VECTOR_MODEL_WORKSPACE_UNRESOLVED` after zero model-operation gaps.

The inference-precision ambiguity is now separately protected-resolved for the correctness lane. Frozen producer evidence distinguishes training FP16 autocast from inference selection, declares inference candidates `fp32` and `fp16_weights`, and leaves producer parity/provider qualification pending with `promotion_ready=false` and `default_activation_ready=false`. The `fp16_weights` candidate is a real fp16-compute graph; it is not a storage-only alias. Vector therefore selected FP32 only as an explicit **correctness qualification candidate**, without claiming producer promotion/default activation or rejecting future fp16 qualification.

Protected Vector PR #22 integrated that bounded precision evidence at merge `118feaee28c7497e0ed4c027687793e840c95bc1`, tree `e877751ff809fafbedd7071d05c5fc7c53f719fc`; the protected merge tree exactly equals the reviewed candidate tree and is GitHub-verified. Protected `Model Tensor Coverage` run `34015432262` and protected required `Repository quality` run `34015432259` both succeeded. The current v3 real-model evidence binds profile `latticeknight-4m-inference-precision-v1`, `selectionRole=qualification_candidate`, `candidate=fp32`, `computeDtype=f32`, public I/O f32, producer promotion/default false, and training precision explicitly outside inference-selection authority.

The current live blocker is therefore the concrete program/resource result, not precision selection: construct the exact normalized FP32 LatticeKnight TensorProgram/TensorPlan from frozen product-owned graph/checkpoint semantics through public CUDA-JS-Tensor, derive exact generic workspace/resource/callable facts from that actual program, then compare full and partial item batches against an independent frozen-model oracle. The current workspace remains intentionally `null`; no byte count or complete executable program is yet frozen.

No Restaurant runtime/native source is imported into Vector production; only immutable producer provenance and declarative model/checkpoint facts are evidence inputs. Existing downstream implementation may be inspected as evidence when the declarative authority is insufficient, but it is not a private/native execution path for Vector or Tensor.

## Current priority order

1. **#3 FP32 TensorProgram/workspace/oracle:** build/freeze one exact LatticeKnight FP32 TensorProgram/TensorPlan through public CUDA-JS-Tensor, derive exact workspace/resource/callable facts, and run the independent full/partial-batch oracle campaign. Route any newly demonstrated generic Tensor or CUDA gap to its natural owner.
2. **CUDA-MCGS #123 parallel consumer falsifier:** prove Vector can consume the exact public `cuda-mcgs` package in an evaluator-free/CUDA-free pre-ignition slice without private imports.
3. **Tensor #22 / CUDA-MCGS #124:** record the complete generic Tensor coverage/workspace/callable result under Tensor #22, then let #124 consume only those public facts for evaluator request identity/batching/scatter/publication while search lifecycle remains CUDA-MCGS-owned.
4. **#2 / #4 product correctness:** chess Domain/Policy oracle and UCI/Search-Session adapter on the already accepted MCGS semantics.
5. Book/timing/tablebase/release integration after their producer/public-contract gates.
6. Native/platform/performance/strength work only after exact correctness/library coverage and physical evidence exist.

`cuda-nn` remains optional. Its #2 justification gate must compare direct Vector -> Tensor composition with a reusable NN layer after this concrete model mapping is explicit; the existence of the repository does not force Vector adoption.

## Hard stop conditions

Stop and route rather than work around if:

- exact model math or precision would be changed merely to fit an existing library surface;
- a generic Tensor mathematical/item/ABI/workspace capability is missing;
- a generic CUDA compiler/runtime/provider mechanism is missing;
- a private sibling source/type or native Vector path seems necessary;
- active search would need a CPU-produced intermediate;
- CUDA libraries would need chess/UCI/model-head/book/timing/tablebase semantics;
- accepted-but-unimplemented authority is being reported as implemented capability;
- portable evidence is being used to claim physical/native support.
