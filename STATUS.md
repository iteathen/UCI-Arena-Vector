# UCI Arena Vector Status

**Updated:** 2026-09-06
**Phase:** first-real-model FP32 independent numerical-oracle qualification
**Current focus:** issue #3 — compare the protected frozen LatticeKnight FP32 public Tensor mapping against an independent checkpoint-bound oracle for full and partial admitted-item occupancy
**Parallel public-package falsifier:** CUDA-MCGS #123 evaluator-free/CUDA-free external consumer

## Product identity

- Product: **UCI Arena Vector**
- Repository: `iteathen/UCI-Arena-Vector`
- Intended executable stem: `uci_arena_vector`
- Product role: independent GPU-resident UCI chess engine for the UCI Arena suite
- Parent plan: #1

Vector remains the product layer. Chess, UCI, concrete model/package/checkpoint/head/precision meaning, opening-book use, timing application, tablebase policy and the independent model-output oracle stay here. CUDA-MCGS, CUDA-JS-Tensor and CUDA-JS are consumed only through public contracts. Vector production gets no C/C++/CUDA/PTX/native-FFI escape path.

The proposed chess product contract is retained as [VECTOR-0001](docs/specs/VECTOR-0001-chess-search-product.md), with issue #2 owning its concrete Domain/Policy continuation. It does not replace the active model qualification work or authorize production search.

## Current upstream state

### CUDA-MCGS

Protected semantic/runtime foundations required by Vector are complete:

- #122 integrated search/evaluator semantic acceptance — complete;
- #109 public package/interface baseline — complete;
- #125 public CUDA-JS runtime adapter — complete;
- #123 external evaluator-free public-package consumer falsifier — parallel consumer lane;
- #124 Tensor evaluator request/batch/scatter/publication connector — open and downstream of completion of the first-real-model correctness gate.

CUDA-MCGS protected #228 reconciles its public CUDA-JS adapter with current publication/header-profile, operation-capacity, public-kernel identity and bound-resource mechanics. That is framework/runtime-adapter maintenance, not Vector product semantics. Physical CUDA-MCGS/CUDA-JS support remains a separate hardware evidence gate.

### CUDA-JS

The lower peer selected by the current protected Tensor pair is:

`cuda-js@0.1.0-alpha.18@45a9ef15537b52d6fd7c615b7e596676dfd00587`

The f32/f64 public `SPEC-0030-tanh-v1` implementation provenance remains protected `d1a8edef5bd06c402a5c14c8945269f206520174`. CUDA-JS #213/#216 subsequently protected the generic bounded Device-JS/compiler admission correction needed by the real Tensor leaf; #216 merged as `45a9ef15537b52d6fd7c615b7e596676dfd00587`, with protected post-merge `verify` `34020219808` and `node-compatibility` `34020219809` successful.

This is portable/software/package capability evidence only. No native/provider or physical NVIDIA support follows.

### CUDA-JS-Tensor

The current Vector capability projection is bound exactly to:

`cuda-js-tensor@0.1.0-alpha.6@0da2c70a0a10df908a33e842aa4ba3dbd7605c48`

That protected pair refresh preserved Tensor mathematics and selected CUDA-JS `45a9ef15537b52d6fd7c615b7e596676dfd00587`; protected Tensor post-merge verify `34020688142` succeeded. The unary:tanh implementation itself remains protected provenance from Tensor #61 at `3a62bc47017aa10198eb1640b66f6b71a608b562`.

Protected Tensor foundations on the first evaluator path are complete:

- #32 ordinary SPEC-0010 `unary:erf`, bounded static gather and ordered concat;
- #52 device-callable f32/f64 `unary:erf`;
- #37 device-callable non-axis-0 static gather/ordered concat child;
- #61 accepted/implemented f32/f64 SPEC-0011 `unary:tanh` through public CUDA-JS;
- #22 now records the generic real-model callable/workspace facts demonstrated by protected Vector #24.

Tensor #22 owns consumer-neutral TensorProgram/TensorPlan coverage, item ABI, workspace/resource and callable facts. Vector retains model/checkpoint/head/precision meaning and the independent product numerical oracle.

## First real model coverage — Vector #3

The frozen model evidence remains:

- model: LatticeKnight-4M / `compact_chessformer_gab_v1`;
- producer: `iteathen/the_restaurant@8c7d75672cee36aa2a39fbddf713041552770b22`;
- package: `model_packages/compact_chessformer_gab_v1.json`;
- package Git blob: `326ba7dd0584438a911baf5051e5f1bedd831274`;
- spec: `specs/compact_chessformer_gab_v1.yaml`;
- run/checkpoint: `run_1784364601_12348`, batch `54499`;
- checkpoint SHA-256: `62dec13c22a4414db6b78ea9b6ca76bcf6f29a16a963c01d13d947d158b09c7e`;
- 227 tensors / 3,637,988 f32 parameters / 14,551,952 parameter bytes;
- input `[N,17,8,8]` f32 = 4,352 bytes/item;
- outputs `[N,4162]` policy + `[N,1]` value = 16,652 bytes/item.

The inference-precision lane remains bounded: profile `latticeknight-4m-inference-precision-v1` selects FP32 only as the correctness `qualification_candidate`; compute and public I/O are f32; producer parity/provider reports remain pending; producer promotion/default activation remain false; training FP16 autocast is not inference-selection authority.

### Protected exact Tensor program/resource gate

Vector #3 / PR #24 is protected on `main` as merge `ca3cce162a73a664a789f6a27a819097ec994bd6`, tree `2182527aa9cd058824d3658a549a2f8224d18db5`. The protected tree exactly equals the final reviewed integration tree. Post-merge `Repository quality` run `34023725885` and `Model Tensor Coverage` run `34023725845` both succeeded.

The product-owned mapper now freezes one normalized public FP32 TensorProgram/TensorPlan against the exact protected pair. Current facts include:

- mixed TensorProgram contract `SPEC-0004-tensor-program-v1+SPEC-0010-erf-gather-concat-v1+SPEC-0011-tanh-v1`;
- 2,216 normalized nodes / 1,340 materialized nodes;
- exact operation counts, selected checkpoint storage offsets and exact f32 scalar constants;
- TensorPlan distinct material bytes at item capacity 1: 24,457,004;
- callable contract `SPEC-0009-item-parallel-device-tensor-program-v1+SPEC-0009-gather-concat-v1`;
- seven-parameter callable ABI with item-varying features, shared parameters/constants, policy/value outputs and one f32 workspace partition;
- per-item workspace: 8,298,631 f32 elements / **33,194,524 bytes**;
- capacity 2 workspace: 66,389,048 bytes, below the public default 67,108,864-byte ceiling;
- capacity 3 requires 99,583,572 bytes and rejects before compiler work with Tensor-owned `TENSOR_DEVICE_WORKSPACE_LIMIT` / `pressure`.

Vector capability snapshot v3 and frozen v2/v3 resource evidence now name Tensor `0da2c70a0a10df908a33e842aa4ba3dbd7605c48` and the exact 33,194,524-byte per-item workspace. Historical pre-tanh evidence explicitly retains `workspace=null` so the old falsifier remains historical rather than being silently reinterpreted.

The coverage verifier now reports `covered_real_model` / `real_model_ready=true`; those fields mean only that its public capability/resource predicate is satisfied. They do **not** mean numerical parity, evaluator readiness, native/provider support, release readiness or product correctness is complete.

### Remaining oracle gate

The live blocker is now only the independent checkpoint-bound numerical oracle required by issue #3 gate 4. The immutable producer revision available in GitHub contains feature golden vectors, graph/spec authority and pending parity/provider declarations, but no checkpoint-bound policy/value output vectors or persisted parity receipt for checkpoint SHA `62dec13c…`.

Expected outputs must therefore not be generated from the Vector Tensor mapper and called independent evidence. The next valid evidence must bind independently produced policy/value outputs to the exact checkpoint and exact input vectors, compare full and partial admitted-item occupancy through the public path, and preserve terminal cleanup/failure evidence.

No Restaurant runtime/native source is imported into Vector production; producer source may be inspected as immutable evidence only.

## Current priority order

1. **#3 independent FP32 model oracle:** obtain or produce checkpoint-bound independent policy/value reference vectors for the exact frozen checkpoint, then compare full and partial admitted-item occupancy against the protected public Tensor mapping with exact identity and cleanup.
2. **CUDA-MCGS #123 parallel consumer falsifier:** prove Vector can consume the exact public `cuda-mcgs` package in an evaluator-free/CUDA-free pre-ignition slice without private imports.
3. **Tensor #22 / CUDA-MCGS #124:** Tensor #22 retains the now-protected generic resource/callable record; #124 may consume only public generic facts after the first-real-model correctness/oracle gate is complete, while evaluator request/batch/scatter/publication/search lifecycle remains CUDA-MCGS-owned.
4. **#2 / #4 product correctness:** chess Domain/Policy oracle and UCI/Search-Session adapter on accepted MCGS semantics.
5. Book/timing/tablebase/release integration after producer/public-contract gates.
6. Native/platform/performance/strength work only after exact correctness/library coverage and physical evidence exist.

`cuda-nn` remains optional. Its #2 justification gate must compare direct Vector -> Tensor composition with a reusable NN layer after concrete model mapping exists; repository existence does not force adoption.

## Hard stop conditions

Stop and route rather than work around if:

- an expected numerical oracle is derived from the implementation under test rather than independent checkpoint-bound evidence;
- exact model math or precision would be changed merely to fit an existing library surface;
- a generic Tensor mathematical/item/ABI/workspace capability is missing;
- a generic CUDA compiler/runtime/provider mechanism is missing;
- a private sibling source/type or native Vector path seems necessary;
- active search would need a CPU-produced intermediate;
- CUDA libraries would need chess/UCI/model-head/book/timing/tablebase semantics;
- accepted-but-unimplemented authority is reported as implemented capability;
- portable evidence is used to claim physical/native support.
