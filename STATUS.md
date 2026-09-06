# UCI Arena Vector Status

**Updated:** 2026-09-05
**Phase:** first-real-model exact TensorProgram/TensorPlan workspace and oracle qualification
**Current focus:** issue #3 — complete frozen LatticeKnight workspace/resource and independent oracle evidence on the protected exact Tensor pair
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

Tensor #22 remains the cross-repository owner of the resulting generic real-model TensorProgram/TensorPlan coverage, workspace/resource, callable and oracle-boundary facts. Vector retains the concrete model/package/checkpoint/head and product-oracle meaning.

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

Protected reassessment had found one correctness omission in the older coverage packet: the frozen value head is `[mean_pool, layer_norm, linear 256->128, relu, linear 128->1, tanh]`, but the old operation inventory did not include its final `tanh`. That omission is now closed by protected exact-pair coverage rather than a local approximation.

Vector capability snapshot v3 preserves v1/v2 as historical evidence and models all four exact current TensorProgram states:

- base: `SPEC-0004-tensor-program-v1`;
- SPEC-0010 only: `SPEC-0004-tensor-program-v1+SPEC-0010-erf-gather-concat-v1`;
- SPEC-0011 only: `SPEC-0004-tensor-program-v1+SPEC-0011-tanh-v1`;
- mixed: `SPEC-0004-tensor-program-v1+SPEC-0010-erf-gather-concat-v1+SPEC-0011-tanh-v1`.

The canonical child order is SPEC-0010 then SPEC-0011. The frozen LatticeKnight operation set selects the mixed contract exactly. `erf`, gather, concat and f32 tanh are all implemented public Tensor capabilities; the refreshed verifier reports `missing_capabilities: []`.

Protected Vector #3 / PR #19 integrated this exact-pair evidence at merge `3d1ae4a00a601259a7ea0a1cd6b8a485132ca459`, tree `8014741e58a643010e008faca81a9d59aeac5b51`. The merge tree exactly equals the reviewed candidate tree. Protected `Repository quality` run `34012907270` and protected `Model Tensor Coverage` run `34012907280` both succeeded.

The current first real-model gate is therefore demonstrated, not predicted: `--require-real` reaches only `VECTOR_MODEL_WORKSPACE_UNRESOLVED`. Workspace remains intentionally `null`; no byte count is yet frozen. The next work must construct the exact normalized concrete model TensorProgram/TensorPlan from product-owned model semantics, derive the generic workspace/resource facts through public Tensor machinery, and then compare full and partial item batches against an independent frozen-model oracle.

No Restaurant runtime/native source is imported into Vector production; only immutable producer provenance and declarative model/checkpoint facts are evidence inputs. Existing downstream implementation may be read as evidence when necessary, but it is not a private/native execution path for Vector or Tensor.

## Current priority order

1. **#3 workspace/oracle:** build/freeze one exact LatticeKnight f32 TensorProgram/TensorPlan through public CUDA-JS-Tensor, derive exact workspace/resource bounds, and run the independent full/partial-batch oracle campaign. Route any newly demonstrated generic Tensor or CUDA gap to its natural owner.
2. **CUDA-MCGS #123 parallel consumer falsifier:** prove Vector can consume the exact public `cuda-mcgs` package in an evaluator-free/CUDA-free pre-ignition slice without private imports.
3. **Tensor #22 / CUDA-MCGS #124:** record the complete generic Tensor coverage/workspace/callable result under Tensor #22, then let #124 consume only those public facts for evaluator request identity/batching/scatter/publication while search lifecycle remains CUDA-MCGS-owned.
4. **#2 / #4 product correctness:** chess Domain/Policy oracle and UCI/Search-Session adapter on the already accepted MCGS semantics.
5. Book/timing/tablebase/release integration after their producer/public-contract gates.
6. Native/platform/performance/strength work only after exact correctness/library coverage and physical evidence exist.

`cuda-nn` remains optional. Its #2 justification gate must compare direct Vector -> Tensor composition with a reusable NN layer after this concrete model mapping is explicit; the existence of the repository does not force Vector adoption.

## Hard stop conditions

Stop and route rather than work around if:

- exact model math would be changed merely to fit an existing library surface;
- a generic Tensor mathematical/item/workspace capability is missing;
- a generic CUDA compiler/runtime/provider mechanism is missing;
- a private sibling source/type or native Vector path seems necessary;
- active search would need a CPU-produced intermediate;
- CUDA libraries would need chess/UCI/model-head/book/timing/tablebase semantics;
- portable evidence is being used to claim physical/native support.
