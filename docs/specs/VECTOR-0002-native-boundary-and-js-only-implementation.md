# VECTOR-0002: Native Boundary and JavaScript/TypeScript Implementation

**Status:** Accepted product architecture authority

**Version:** 1.0.0

**Owner:** UCI Arena Vector

**Lower authority:** `iteathen/CUDA-JS` SPEC-0032

## Purpose

This specification fixes Vector's implementation boundary as a downstream product in the CUDA-JS ecosystem.

Vector owns chess/UCI/product/model/checkpoint/head/feature/action/tolerance and publication meaning. It does not own native CUDA/provider integration.

## Repository implementation rule

Maintained Vector source is JavaScript/TypeScript. Restricted Device-JS generation is permitted only through accepted public lower-library contracts.

Vector does not maintain C, C++, CUDA C++, PTX, direct native FFI, native addons, Driver/provider bindings, native handles/pointers, ABI structs or platform discovery code.

A missing generic native capability discovered by Vector is routed to CUDA-JS. A missing generic Tensor capability is routed to CUDA-JS-Tensor. A missing reusable NN abstraction is routed to cuda-nn only when independently justified. A missing search/framework semantic capability is routed to CUDA-MCGS. Product-local native workarounds are forbidden.

Native evidence may be produced externally and recorded against exact dependencies/hardware, but native oracle/provider source is not maintained in Vector.

## Vector-owned abstraction

Vector retains:

- concrete model/checkpoint/package provenance;
- chess feature encoding and action/policy mapping;
- value/head/output interpretation;
- product numerical tolerances and checkpoint-bound expected-output authority;
- UCI/search-product policy and publication meaning;
- product-specific resource/performance choices;
- JavaScript/TypeScript product reference/oracle code.

Those facts do not become Tensor, MCGS or CUDA-JS authority merely because those libraries execute them.

## Lower mechanism boundary

CUDA-JS owns native device/context/memory/compiler/artifact/module/function/operation/provider mechanisms. CUDA-JS-Tensor owns generic Tensor math/planning/callable semantics. CUDA-MCGS owns reusable search/evaluator/search-lifecycle semantics. Vector composes public contracts only.

## Numerical evidence

Vector's independent checkpoint/model oracle must remain independent from the Tensor mapper/execution implementation. Repository-maintained oracle source is JavaScript/TypeScript. External producer/native evidence may supplement provenance but does not authorize a Vector-local native implementation.

## Memory boundary

Vector may own product-specific model residency, batch sizing or product resource policy. It does not own native allocation APIs or a generic physical memory manager. Reusable cross-domain memory policy, if later justified, must live in its natural JavaScript/TypeScript owner above CUDA-JS and remain free of chess/model vocabulary.

## Relationship to VECTOR-0001

VECTOR-0001 remains the product semantic proposal. This specification constrains implementation ownership and language regardless of which search/evaluator profile VECTOR-0001 later selects.

## Non-goals

No production native backend, no transfer of product semantics into reusable libraries, no support/performance promotion, and no authorization of currently gated search/model work.
