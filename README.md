# UCI Arena Vector

**UCI Arena Vector** is a GPU-resident chess engine for the UCI Arena suite.

Vector is an independent UCI engine product. It uses the public `cuda-mcgs`, `cuda-js`, and `cuda-js-tensor` libraries, but its product identity and public contracts do not depend on those implementation names remaining permanent.

## Product boundary

Vector owns:

- UCI protocol behavior and engine lifecycle;
- chess state/action/history/legality/terminal semantics;
- chess-specific MCGS policy, backup, root-result and analysis semantics;
- model package, feature, action-index and output-head semantics;
- adapters for Book Forge opening-book snapshots, Timing Evidence policies, and Syzygy/tablebase resources;
- composition of those product inputs into public CUDA-MCGS contracts;
- diagnostics, immutable evidence, release artifacts and component identity.

Vector does **not** own:

- generic CUDA compilation/runtime/resource mechanisms (`cuda-js`);
- generic tensor mathematics/planning (`cuda-js-tensor`);
- universal MCGS graph/evaluator/resource/progress contracts (`cuda-mcgs`);
- Book Forge acquisition/qualification;
- Timing Evidence campaign/statistical publication;
- Manager, Installer, or Lichess transport behavior.

## Architecture

```text
UCI / product composition
        |
        +--> chess contract + root/history admission
        +--> opening-book adapter
        +--> timing-policy adapter
        +--> tablebase adapter
        +--> model/evaluator adapter
        |
        v
     cuda-mcgs
 universal MCGS library
     |       |
     v       v
 cuda-js  cuda-js-tensor
     ^       |
     |_______|
       CUDA GPU
```

The initial product host is Node.js so Vector can consume the JavaScript libraries directly. This avoids an unnecessary native-to-Node search bridge. Active search, chess transition work, graph work, evaluator work, batching, backup and progress remain device-resident after ignition. Host work is limited to protocol/input admission, pre-ignition composition, externally authoritative root/control changes, bounded asynchronous observation/result consumption, cancellation and teardown.

## LEGO rules

Architecture follows:

```text
domain truth -> LEGO ownership -> SOLID -> CUPID -> KISS -> evidence
```

Hard constraints:

- complete module isolation;
- agnostic interface naming;
- transient topology;
- one visible owner for each semantic fact, resource, identity and lifecycle;
- no sibling-repository internal source imports;
- no per-node/per-edge/per-evaluator host callbacks after ignition;
- finite predeclared resources and typed pressure/exhaustion;
- no hidden CPU search fallback inside a GPU-qualified profile;
- exact failure, cancellation and cleanup truth;
- performance/strength/support claims only from exact evidence.

## Suite integration

- Book Forge is an independent producer. Vector consumes immutable published snapshot contracts through its own opening-book adapter.
- Timing Evidence Service is an independent producer. Vector consumes qualified timing-policy artifacts; timing controls **when to publish**, never GPU search attention/depth/topology/queues/batches.
- Syzygy/tablebase semantics stay product-owned. The first GPU profile may use exact root resolution or root-safe constraints without inserting CPU tablebase callbacks into active device search.
- Manager/Installer integrate Vector as a separate component with its own manifest and release identity.
- Lichess Bot sees Vector only as a conforming UCI executable.

## Current phase

Specification and connector planning only. Production implementation begins only after the owning contracts are accepted and upstream CUDA-MCGS connector/native gates are dependency-ready.

See `AGENTS.md`, `STATUS.md`, `next_step.yaml`, and `docs/architecture/CONNECTOR_MAP.md` before making changes.
