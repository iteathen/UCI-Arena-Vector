# UCI Arena Vector

[![Repository quality](https://github.com/iteathen/UCI-Arena-Vector/actions/workflows/repository-quality.yml/badge.svg)](https://github.com/iteathen/UCI-Arena-Vector/actions/workflows/repository-quality.yml)
[![License: GPL-3.0](https://img.shields.io/github/license/iteathen/UCI-Arena-Vector)](LICENSE)

UCI Arena Vector is a planned GPU-resident UCI chess engine product.

## Current reality

**There is no runnable Vector engine or supported engine release yet.** The repository is currently specification and connector work for the product that will compose public CUDA-MCGS, CUDA-JS, CUDA-JS-Tensor, opening-book, timing-evidence, and tablebase contracts.

What exists today:

- Vector-owned UCI/chess/product contracts and architecture;
- explicit connector/ownership maps to the supporting libraries and UCI Arena services;
- repository validation and protected-branch CI;
- governed dependency/next-step state.

What does **not** exist today:

- a production GPU search runtime;
- a UCI executable suitable for tournaments;
- a qualified end-to-end CUDA-MCGS/Tensor/Vector engine pair;
- engine-strength, latency, or performance claims.

## Verify what exists

```bash
node tools/verify-repository.mjs
git diff --check
```

These checks validate the repository/contracts. They do not prove a chess engine exists or qualify GPU search.

The current dependency-ready action is recorded in [`next_step.yaml`](next_step.yaml); current truth is summarized in [`STATUS.md`](STATUS.md).

## Product boundary

Vector owns:

- UCI protocol behavior and engine lifecycle;
- chess state, action, history, legality, and terminal semantics;
- chess-specific MCGS policy, backup, root-result, and analysis semantics;
- model feature/action/output semantics;
- adapters for Book Forge opening books, Timing Evidence policies, and Syzygy/tablebase resources;
- product composition, diagnostics, evidence, and release identity.

Vector does **not** own generic CUDA runtime/compiler/memory behavior, generic tensor mathematics, universal MCGS graph/resource/progress contracts, Book Forge production, Timing Evidence publication, Manager/Installer behavior, or Lichess transport.

A missing generic capability is requested from its public owning library with Vector acceptance criteria. Vector does not deep-import sibling internals or add native escape paths to bypass a missing library contract.

## Intended execution shape

```text
UCI / Vector product semantics
        |
        v
     CUDA-MCGS
        |
        +--> CUDA-JS
        +--> CUDA-JS-Tensor
        |
        v
       GPU
```

Book Forge, Timing Evidence, and tablebase integrations enter through Vector-owned adapters. Lichess sees only a future conforming UCI executable.

Detailed connector ownership is in [`docs/architecture/CONNECTOR_MAP.md`](docs/architecture/CONNECTOR_MAP.md).

## Development rule

Once the next connector boundary is accepted and dependency-ready, prefer the thinnest meaningful executable Vector slice through the same public contracts intended for production before expanding architecture further.

Concurrency, optimization, strength machinery, or API breadth is not prioritized because a theoretical ceiling exists. It must be required by the next executable product path or by measured evidence.

No native C/C++/CUDA escape path belongs in Vector. An apparent need for one triggers classification of the missing CUDA-JS, CUDA-JS-Tensor, CUDA-MCGS, or product-owned capability before implementation.

## Start here

- [Current status](STATUS.md)
- [Governed next step](next_step.yaml)
- [Architecture connector map](docs/architecture/CONNECTOR_MAP.md)
- [How to contribute](CONTRIBUTING.md)
- [Project governance](GOVERNANCE.md)
- [Security policy](SECURITY.md)

## Contributing and security

Read [`AGENTS.md`](AGENTS.md) and [`CONTRIBUTING.md`](CONTRIBUTING.md) before changing behavior. Do not begin production search implementation while its dependency gate is closed.

Report vulnerabilities privately according to [`SECURITY.md`](SECURITY.md), not through public issues.

UCI Arena Vector is licensed under the [GNU General Public License v3.0](LICENSE).
