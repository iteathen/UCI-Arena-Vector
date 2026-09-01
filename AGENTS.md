# UCI Arena Vector Agent Entry Point

Read this file before changing the repository.

## Product purpose

UCI Arena Vector is an independent GPU-resident UCI chess-engine product. It consumes public `cuda-mcgs`, `cuda-js`, and `cuda-js-tensor` library contracts plus published UCI Arena service/component contracts.

Vector is not a CUDA runtime, tensor framework, MCGS framework, opening-book producer, timing-evidence producer, Manager, Installer, or Lichess provider.

## Authority order

1. Explicit current project-owner instruction.
2. This file and accepted Vector ADR/specification files.
3. `docs/architecture/` and `contracts/`.
4. `STATUS.md` and `next_step.yaml`.
5. Plans/research notes.
6. Historical or superseded material.

## Portfolio readiness gate

Before selecting, expanding, reviewing, or closing meaningful work, ask: **what is the highest-risk unproven boundary currently preventing the next real composed capability?**

Unless accepted Vector authority or the actual dependency graph requires a different order, prioritize:

1. security/correctness boundary defects;
2. missing foundational producer capability required by a dependency-ready Vector path;
3. missing qualification/evidence/infrastructure for an implemented required capability;
4. missing thin end-to-end Vector composition proof through public CUDA-MCGS, CUDA-JS, CUDA-JS-Tensor, Book Forge, Timing Evidence, tablebase, or UCI contracts as applicable;
5. measured performance, concurrency, latency, or strength bottlenecks required by the product;
6. convenience/API expansion;
7. community/presentation polish.

Keep architectural disposition, implementation status, qualification/support status, and priority separate. Missing GPU/host/CI/service evidence is an evidence or qualification-infrastructure gap unless an implementation is independently falsified; do not manufacture a product or library code fix for absent evidence. Qualification infrastructure is product infrastructure when a release/support claim depends on it.

Cross-repository dependencies are public capability edges. Vector states the required public capability and acceptance criteria; the owning producer implements and qualifies it without importing Vector-specific policy. If a need naturally belongs in CUDA-JS, CUDA-JS-Tensor, CUDA-MCGS, Book Forge, Timing Evidence, or another published owner, stop and classify that dependency rather than deep-importing internals or creating a local escape path.

Specifications protect real ownership and product semantics; they are not an end state. Once the next connector/boundary is sufficiently specified and dependency-ready, prefer the thinnest meaningful executable Vector slice through the same public contracts intended for production over additional speculative layering. Do not prioritize concurrency, optimization, strength machinery, or API breadth merely because a theoretical ceiling exists; require a measured product bottleneck or the next real vertical path.

PR/closure evidence must state which blocker class changed, the exact evidence supporting that transition, what remains unproven, and which downstream composed capability is newly unblocked.

## Design hierarchy

```text
domain truth
  -> LEGO ownership
  -> SOLID responsibility
  -> CUPID composability
  -> KISS among complete designs
  -> exact evidence
```

## Mandatory LEGO rules

### Complete module isolation

Each component owns only its local semantics and lifecycle. Do not reference foreign product internals, sibling-repository source layout, private object types, or current wiring inside a component's internal logic.

### Agnostic interface naming

Ports, events, properties and internal interfaces describe local facts/actions rather than the identity of the current provider or consumer.

### Transient topology

External connections are replaceable. Vector modules operate against public contracts so libraries/services can be swapped without rewriting unrelated internals.

## Native-code diagnostic — hard rule

**Vector production source must not add C, C++, CUDA C++, hand-written PTX, a native addon, direct CUDA Driver/runtime FFI, or a subprocess native search implementation.**

An apparent need for native code is evidence of a missing library or boundary capability and triggers classification **before implementation**:

1. If the missing need is a generic CUDA compiler/runtime/memory/synchronization/execution mechanism, it belongs in `cuda-js` behind a consumer-neutral public contract.
2. If the missing need is generic tensor/dense-math planning or execution, it belongs in `cuda-js-tensor` behind a consumer-neutral public contract.
3. If the missing need is universal MCGS graph/evaluator/resource/progress/session meaning, it belongs in `cuda-mcgs` behind a product-neutral public contract.
4. If the need is chess/UCI/model/book/timing/tablebase product meaning, keep it in Vector using ordinary JavaScript and restricted Device-JS, or consume an already published external product contract. Do not export product semantics merely to obtain native implementation.
5. If no natural existing owner can express the need without semantic distortion, stop and create an explicit architecture-gap plan rather than building a local native escape path.

The desire to write native code is enough to trigger this test. Do not build the workaround first.

## Source-language boundary

- Host/product/composition code: ordinary JavaScript/Node.js.
- Device search/domain/policy/evaluator code: restricted Device-JS through public CUDA-MCGS/CUDA-JS contracts.
- Dense math: public CUDA-JS-Tensor contracts.
- Generated CUDA/PTX/cubin/LTO/native artifacts are library-owned opaque outputs, never maintained Vector source.
- No Python in the Vector repository, build, tests, tools, CI, packaging, experiments, or release automation.

## Device-closure rule

After search ignition, active search progress may not require a CPU-produced intermediate result.

Selection, expansion, chess transition/legality work, graph operations, evaluator feature work, tensor inference, backup, scheduling, stopping and selected search-result computation remain device-owned for the qualified GPU profile.

Allowed host activity after ignition is limited to:

- externally authoritative root/control input;
- bounded asynchronous read-only observations/results;
- cancellation/stop requests;
- completion/error/teardown lifecycle.

A read-result -> host decision -> write-search-control loop required for internal progress is non-conforming.

## Repository boundaries

### Vector owns

- UCI protocol/product lifecycle;
- chess semantics and product Device-JS realization;
- chess MCGS policy/output semantics;
- model feature/action/output semantics;
- Book Forge consumer adapter;
- Timing Evidence policy consumer/application adapter;
- tablebase/Syzygy consumer semantics;
- library composition and product compatibility identity;
- diagnostics/evidence/release artifacts.

### `cuda-mcgs` owns

- universal MCGS semantic core;
- Search IR/Composer/specialization;
- graph/evaluator/resource/progress/session semantics;
- CUDA-JS runtime adapter;
- generic Tensor evaluator connector.

### `cuda-js-tensor` owns

- tensor specs/shapes/dtypes/strides;
- consumer-neutral dense operations;
- item-parallel device-callable Tensor program mechanism;
- tensor workspace/lifecycle/identity.

### `cuda-js` owns

- CUDA device selection and target resolution;
- restricted Device-JS language/lowering;
- compile/link/load/cache artifacts;
- memory/views/operations/synchronization/publication;
- generic native library/provider mechanisms;
- CUDA-specific lifecycle and platform qualification.

## Suite integrations

- Book Forge produces immutable opening-book snapshots. Vector consumes them through a product adapter; CUDA libraries never parse Book Forge artifacts.
- Timing Evidence Service produces qualified timing-policy/profile artifacts. Vector applies them with live clock facts; timing never directs GPU search work.
- Tablebase semantics are Vector-owned. The first conforming profile may resolve/constraint roots before search; do not add CPU tablebase callbacks inside active GPU search. If a useful internal tablebase profile appears to require native support, classify the needed generic mechanism/library boundary first.
- Manager/Installer consume Vector's own component/release contracts.
- Lichess Bot sees only a conforming UCI executable.

## Hot-path rules

No strings, JSON, filesystem I/O, network I/O, dynamic reflection, unbounded allocation, blocking host synchronization, or provider-name branching in device search/evaluator hot paths.

No per-node/per-edge/per-simulation/per-evaluator-row host callback.

## Evidence rules

- Exact correctness precedes performance and strength promotion.
- Mocks prove only the semantics they execute.
- Native/support/performance claims name exact library revisions, package identities, OS, Node, Driver/toolkit, GPU and evidence.
- Missing hardware evidence stays missing; do not promote from mock/portable/neighboring profiles.
- Failure, cancellation, pressure, partial validity and cleanup are first-class tested outcomes.

## Current phase

Specification/connector planning. Do not implement production search until `next_step.yaml` marks the owning dependency node ready.
