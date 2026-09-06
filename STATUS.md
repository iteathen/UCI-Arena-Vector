# UCI Arena Vector Status

**Updated:** 2026-09-05
**Phase:** first-real-model public-library coverage and external-consumer preparation
**Current focus:** issue #3 — exact LatticeKnight model-to-Tensor coverage; corrected `unary:tanh` gap
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

Physical CUDA-MCGS/CUDA-JS support remains a separate hardware evidence gate and is not implied by portable consumer work.

### CUDA-JS

The exact lower peer currently consumed by protected Tensor is `cuda-js@0.1.0-alpha.18@30d11a5d38dd7b9987bc8bac4ac67c2fcf8fee60`. No new generic CUDA mechanism is currently demonstrated by the Vector model coverage campaign. Physical/native support issues remain evidence-gated.

### CUDA-JS-Tensor

Current protected provider revision for this coverage packet is:

`cuda-js-tensor@0.1.0-alpha.6@62cc5f1076766219fc6e3561eee86cdd66803813`

Protected Tensor capability foundations on the first evaluator path are complete:

- #32 ordinary SPEC-0010 `unary:erf`, bounded static gather and ordered concat;
- #52 device-callable f32/f64 `unary:erf`;
- #37 device-callable non-axis-0 static gather/ordered concat child.

Tensor #22 remains the cross-repository real-model readiness outcome. It does not imply an unidentified Tensor implementation gap.

## First real model coverage — Vector #3

The first model remains durably frozen from the prior qualified evidence packet:

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

Fresh current-main reassessment found one correctness omission in the older coverage packet: the frozen value head is `[mean_pool, layer_norm, linear 256->128, relu, linear 128->1, tanh]`, but the old operation inventory did not include its final `tanh`.

The current capability projection therefore distinguishes exact TensorProgram identities:

- base: `SPEC-0004-tensor-program-v1`;
- extension: `SPEC-0004-tensor-program-v1+SPEC-0010-erf-gather-concat-v1`.

`erf`, `gather` and `concat` are now covered by protected public Tensor authority. The corrected frozen-model coverage must fail closed on exactly one remaining semantic requirement, `unary:tanh`, unless an independently reviewed mathematically/numerically equivalent public composition is demonstrated against the frozen model oracle. A formula is not silently accepted merely because it is algebraically equivalent.

If/when tanh coverage is closed, the next known gate is the complete static TensorProgram/TensorPlan plus exact workspace/resource bound. Numerical parity against the frozen checkpoint remains separately required before evaluator readiness.

No Restaurant runtime/native source is imported; only immutable producer provenance and declarative architecture/checkpoint facts are evidence inputs.

## Current priority order

1. **#3 correctness/coverage:** prove the corrected LatticeKnight public Tensor capability matrix, route `tanh` to the natural owner if genuinely missing, then build/freeze the complete f32 TensorProgram/TensorPlan and workspace bound.
2. **CUDA-MCGS #123 parallel consumer falsifier:** prove Vector can consume the exact public `cuda-mcgs` package in an evaluator-free/CUDA-free pre-ignition slice without private imports.
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
- portable evidence is being used to claim physical/native support.
