# UCI Arena Vector

UCI Arena Vector is a planned GPU-resident chess engine with a standard UCI interface, intended for chess GUIs and the UCI Arena suite.

**There is no runnable Vector engine or supported engine release yet.**

## What exists

The repository contains chess/UCI product contracts, architecture and connector maps, model-to-Tensor coverage tooling, and repository validation. Current work addresses the first model's precision, workspace/resource requirements, and independent numerical evidence.

There is no qualified end-to-end GPU engine, tournament executable, or engine-strength, latency, or performance claim.

## Intended engine

Vector aims to combine GPU-resident Monte Carlo Graph Search and tensor evaluation through public CUDA-MCGS, CUDA-JS, and CUDA-JS-Tensor libraries. Planned product integrations include opening books, timing policies, and tablebase resources.

Vector owns chess rules, UCI behavior, model inputs/outputs, and engine lifecycle. Generic search, tensor mathematics, and CUDA execution remain with their libraries. See the [connector map](docs/architecture/CONNECTOR_MAP.md) for the integration design.

## Start here

Start with [current status](STATUS.md) to assess development progress and unresolved dependencies. There are no engine installation instructions yet.

Contributors can validate repository structure from a Git checkout with Node.js and Git available:

```bash
git clone https://github.com/iteathen/UCI-Arena-Vector.git
cd UCI-Arena-Vector
node tools/verify-repository.mjs
```

This validates repository documents and contracts, not chess-engine operation.

- [Next development step](next_step.yaml).
- [Contributing](CONTRIBUTING.md) and [developer instructions](AGENTS.md).
- [Support](SUPPORT.md), [governance](GOVERNANCE.md), and [private security reporting](SECURITY.md).
- [GNU GPL v3 license](LICENSE).
