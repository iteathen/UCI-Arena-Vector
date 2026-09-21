# Evidence status

This repository follows the shared [iteathen evidence and validation policy](https://github.com/iteathen/.github/blob/main/EVIDENCE_POLICY.md).

## Current posture

UCI Arena Vector is a planned engine with repository tooling and model/Tensor qualification work, but no runnable supported engine release. Repository validation and model-coverage tooling are **INTERNAL-QUALIFICATION** unless a record explicitly names an external oracle.

## Registered claims

| Claim | Evidence class | Status |
| --- | --- | --- |
| `VECTOR-INT-001` — repository contracts and model/Tensor coverage artifacts pass maintained repository checks | **INTERNAL-QUALIFICATION** | repository-controlled |
| `VECTOR-ENGINE-001` — a qualified end-to-end GPU chess engine exists with established strength/latency/performance | **UNVALIDATED** | explicitly not claimed |

Machine-readable records: [`evidence/claims.json`](evidence/claims.json).

## What current evidence establishes

Current evidence can establish document/contract integrity and the exact model/Tensor capability/resource checks encoded by the repository.

## What it does not establish

It does not establish a runnable tournament engine, end-to-end GPU correctness, playing strength, latency, speedup, or independent reproduction.

## Path to stronger evidence

Once an engine exists, strength claims should use established chess test suites, published positions/oracles where applicable, reproducible engine matches, exact model/runtime revisions, and hardware-measured results.

## Non-mutation rule

Evidence work may exercise Vector's validation/qualification tooling, but must not alter chess semantics, engine policy, search behavior, or product runtime merely to obtain favorable evidence.
