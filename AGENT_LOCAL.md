# Repository context: UCI-Arena-Vector

Universal engineering and design guidance comes from the account-global `AGENTS.md`.

## Mission and ownership

Vector is an independent GPU-resident UCI chess-engine product. It owns UCI/product lifecycle, chess semantics and product Device-JS realization, chess search policy/output semantics, model feature/action/output meaning, product adapters, library composition, diagnostics/evidence, and release artifacts.

CUDA-MCGS owns universal search/evaluator/resource/session semantics. CUDA-JS-Tensor owns generic Tensor semantics. CUDA-JS owns CUDA compiler/runtime/memory/provider/lifecycle mechanisms.

## Decision reasoning

Before a substantive architecture, design, implementation-selection, or cross-component
decision, read `reasoning/component_graph_v1.yaml` and the canonical suite graph at
`iteathen/uci-arena-installer/reasoning/suite_graph_v1.yaml`.

Use the graph to expose relevant implicit assertions rather than promoting a local repair or
performance result into global authority. Accepted Vector specifications/contracts remain
behavior authority. A reasoning/spec contradiction triggers review and evidence work rather
than silent divergence.

## Local routing

- `STATUS.md` and `next_step.yaml` — current execution/dependency state.
- Accepted Vector ADR/specification files — product authority.
- `docs/architecture/` and `contracts/` — product architecture and external contracts.

## Local constraints

Maintained source uses ordinary JavaScript/Node.js and restricted Device-JS through public library contracts. No Python, direct CUDA FFI, C/C++/CUDA C++, hand PTX, native addon, or subprocess-native search implementation. After search ignition, active search progress remains device-closed except for external control, bounded observation, cancellation, completion, and teardown.
