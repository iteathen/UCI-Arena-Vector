# UCI Arena Vector

[![Repository quality](https://github.com/iteathen/UCI-Arena-Vector/actions/workflows/repository-quality.yml/badge.svg)](https://github.com/iteathen/UCI-Arena-Vector/actions/workflows/repository-quality.yml)
[![License: GPL-3.0](https://img.shields.io/github/license/iteathen/UCI-Arena-Vector)](LICENSE)

**UCI Arena Vector** is an open-source, GPU-resident UCI chess engine. Its goal is to keep chess search, graph work, evaluation, batching, and backup on the GPU after search ignition while retaining a standard UCI boundary for chess interfaces and tournament tooling.

Vector is an independent UCI engine product. It uses the public `cuda-mcgs`, `cuda-js`, and `cuda-js-tensor` libraries, but its product identity and public contracts do not depend on those implementation names remaining permanent.

> [!IMPORTANT]
> Vector is currently in specification and connector planning. There is no supported engine release or runnable production search yet. Contributions to the active contracts, independent chess oracle design, documentation, and connector reviews are welcome.

## Start here

- [Current status](STATUS.md)
- [Governed next step](next_step.yaml)
- [Architecture connector map](docs/architecture/CONNECTOR_MAP.md)
- [Vector-owned chess search product boundary](docs/specs/VECTOR-0001-chess-search-product.md)
- [How to contribute](CONTRIBUTING.md)
- [Project governance](GOVERNANCE.md)
- [Security policy](SECURITY.md)

## Product boundary

Vector owns:

- UCI protocol behavior and engine lifecycle;
- chess state/action/history/legality/terminal semantics;
- chess-specific MCGS policy, backup, root-result and analysis semantics;
- model package, feature, action-index and output-head semantics;
- adapters for Book Forge opening-book snapshots, Timing Evidence policies, and Syzygy/tablebase resources;
- composition of those product inputs into public CUDA-MCGS contracts;
- diagnostics, immutable evidence, release artifacts and component identity.

The normative product boundary is [`VECTOR-0001`](docs/specs/VECTOR-0001-chess-search-product.md). CUDA-MCGS deliberately contains no Vector or chess product specification.

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

## Contributing

Public contributions are welcome. The most useful work today is careful review of Vector-owned contracts, independently reproducible chess fixtures, boundary analysis, documentation, and issue refinement. Start with [CONTRIBUTING.md](CONTRIBUTING.md) and an existing issue; do not begin production search implementation while its dependency gate is closed.

Questions and design discussions belong in [GitHub Discussions](https://github.com/iteathen/UCI-Arena-Vector/discussions). Reproducible defects and scoped proposals belong in [GitHub Issues](https://github.com/iteathen/UCI-Arena-Vector/issues).

## Security

Do not disclose suspected vulnerabilities in a public issue. Follow [SECURITY.md](SECURITY.md) to report them privately.

## License

UCI Arena Vector is licensed under the [GNU General Public License v3.0](LICENSE).
