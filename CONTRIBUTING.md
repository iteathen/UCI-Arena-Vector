# Contributing to UCI Arena Vector

Thank you for helping build Vector. The project welcomes precise, reviewable contributions that preserve its GPU-resident design and independent LEGO boundary.

## Before you start

1. Read [AGENTS.md](AGENTS.md), [STATUS.md](STATUS.md), and [next_step.yaml](next_step.yaml).
2. Check the [open issues](https://github.com/iteathen/UCI-Arena-Vector/issues) for the current owner, dependency gate, and acceptance criteria.
3. Comment on the issue before substantial work so contract decisions are coordinated rather than duplicated.
4. For a new direction, open an architecture proposal before writing implementation code.

Vector is currently in specification and connector planning. Useful contribution lanes include:

- chess-domain and policy-contract review;
- independent differential-oracle and fixture design;
- public connector-contract review;
- bounded failure, cancellation, pressure, and cleanup cases;
- documentation, accessibility, and repository tooling.

Production CUDA-MCGS lowering is not ready. A change that needs C, C++, CUDA C++, PTX, a native addon, direct CUDA FFI, Python, a native search subprocess, a private sibling-repository import, or a CPU-produced active-search intermediate is an architecture-gap report—not a Vector implementation shortcut.

## Propose a change

- Use the contract/architecture issue form for new behavior or boundary changes.
- Keep one coherent ownership-sized change per pull request.
- Name the authoritative owner and the cheapest decisive falsifier.
- Prefer public contracts and deterministic evidence over current-neighbor assumptions.
- Do not include credentials, private artifacts, generated binaries, model weights, or machine-specific output.

For vulnerabilities, do not open an issue; use the private process in [SECURITY.md](SECURITY.md).

## Develop locally

Use a topic branch in your fork. Repository checks require a current Node.js LTS release and no package installation:

```powershell
node tools/verify-repository.mjs
git diff --check
```

The same checks run in pull requests. Add focused validation for any new contract or executable behavior; a green generic repository check does not substitute for domain evidence.

## Commit and pull request

- Write focused commits with an imperative subject.
- Certify origin with a Developer Certificate of Origin sign-off: `git commit -s`.
- Complete the pull-request template and link the owning issue.
- Explain contract and lifecycle effects, important bounds, failure modes, and checks run.
- Update authoritative documentation in the same pull request when behavior or ownership changes.
- Respond to review with new commits; do not rewrite shared history after review begins unless a maintainer asks.

By contributing, you agree that your contribution is licensed under this repository's [GPL-3.0 license](LICENSE). The `Signed-off-by` line certifies the [Developer Certificate of Origin 1.1](https://developercertificate.org/).

## Review standard

Acceptance requires domain correctness, LEGO ownership, bounded resources, exact failure/cancellation/cleanup behavior, and evidence appropriate to the claim. Maintainers may close proposals that bypass an owning repository or duplicate an authority, but the underlying need should be routed to its correct owner.

All participation is governed by the [Code of Conduct](CODE_OF_CONDUCT.md).
