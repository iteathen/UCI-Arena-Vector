# Repository context: UCI-Arena-Vector

Universal engineering and design guidance comes from the account-global `AGENTS.md`.

## Mission and ownership

Vector is an independent GPU-resident UCI chess-engine product. It owns UCI/product lifecycle, chess semantics and product Device-JS realization, chess search policy/output semantics, model feature/action/output meaning, product adapters, library composition, diagnostics/evidence, and release artifacts.

CUDA-MCGS owns universal search/evaluator/resource/session semantics. CUDA-JS-Tensor owns generic Tensor semantics. CUDA-JS owns CUDA compiler/runtime/memory/provider/lifecycle mechanisms.

## Local routing

- `STATUS.md` and `next_step.yaml` — current execution/dependency state.
- Accepted Vector ADR/specification files — product authority.
- `docs/architecture/` and `contracts/` — product architecture and external contracts.

## Local constraints

Maintained source uses ordinary JavaScript/Node.js and restricted Device-JS through public library contracts. No Python, direct CUDA FFI, C/C++/CUDA C++, hand PTX, native addon, or subprocess-native search implementation. After search ignition, active search progress remains device-closed except for external control, bounded observation, cancellation, completion, and teardown.