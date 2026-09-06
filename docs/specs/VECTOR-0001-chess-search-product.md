# VECTOR-0001: Chess Search Product Boundary

**Status:** Proposal

**Draft version:** 0.1.0

**Owner:** UCI Arena Vector
**Tracker:** [Vector issue #2](https://github.com/iteathen/UCI-Arena-Vector/issues/2)

This contract succeeds the former framework-local `CHESS-0001` proposal. Product authority moves here; the framework retains only its public, product-neutral contracts and historical Git provenance.

## Purpose

This specification owns the chess search product semantics supplied by UCI Arena Vector to a replaceable graph-search framework. Chess, UCI, product policy, model meaning, tablebase meaning, opening-book behavior, timing application, and user-facing engine output remain Vector concerns. They do not amend or specialize the public contracts of a framework merely because Vector consumes it.

The current composition uses public CUDA-MCGS contracts. That connection is transient topology: replacing the framework with another conforming implementation must not change Vector's chess truth or make library names part of internal chess interfaces.

## Product outcome

Vector will compose a finite GPU-resident search product that:

- admits exact authoritative chess positions and histories;
- performs selected chess transition, policy, evaluation, graph, and backup work without a host-produced active-search intermediate;
- preserves reusable search evidence only when the owning chess and policy identities permit it;
- publishes bounded UCI-facing observations and a legal final move; and
- remains independently testable against chess authorities that do not share its implementation.

This proposal does not authorize production search implementation. The gates in [`STATUS.md`](../../STATUS.md) and [`next_step.yaml`](../../next_step.yaml) remain authoritative.

## Owned LEGO contracts

### Chess domain

The chess Domain owner defines:

- board and position representation;
- side to move;
- action encoding, legal move generation, and transition;
- check, checkmate, stalemate, and terminal truth;
- castling and en-passant meaning;
- repetition, rule-50, and other history-sensitive draw facts;
- state, transposition, history, and collision-verification identity; and
- variant facts if a later Vector profile deliberately selects them.

Piece placement alone is not sufficient identity. Every fact that can change legality, terminal truth, transition, evaluation input, root authority, or reuse validity must be represented or separately keyed by its authoritative owner.

### Chess search policy

The Policy owner defines the selected product behavior for candidate selection/admission, in-flight reservation, backup algebra, value interpretation and perspective, stopping/budget inputs, UCI `searchmoves`, and reuse/reset/invalidation after an authority change.

No particular selection formula or value representation is accepted by this boundary document. Concrete policy profiles require their own exact semantics and evidence.

### Evaluator and model semantics

Vector owns feature meaning, action mapping, output meaning, perspective, package identity, compatibility, numerical equivalence, and reuse validity for any selected evaluator. The evaluator is optional at the product-contract level and its concrete form is not selected here.

Dense mathematical execution may be delegated through a consumer-neutral tensor contract. Delegation never transfers model meaning, chess encoding, request identity, search scheduling, or publication authority to the tensor provider or search framework.

### Product output and UCI publication

Vector owns the complete legal candidate set for the current authoritative position, late-bound move comparison and tie behavior, bounded analysis observations, UCI `info`/`bestmove` translation, final legality/current-position fencing, and publication timing/protocol ordering.

Diagnostic summaries are not a second move authority. A request to observe or publish must not mutate search evidence or cause hidden search progression.

## Position changes and persistent search

Vector translates UCI/product authority into framework-neutral lifecycle intent: establish an initial position; advance to an already-realized ready successor when permitted; replace/reconcile a position when general admission is required; change optional attention/control without creating another search lifetime; and cancel, close, or publish without mislabeling stale evidence as current.

After an authority change, each persistent fact family receives an owner-defined disposition. Physical retention does not prove semantic reuse. At minimum Vector must classify domain identity, policy evidence, evaluator cache entries, path/history facts, publication state, and product extension state.

## Optional product capabilities

Opening-book, timing-policy, tablebase, tactical/proof, diagnostic, and analysis capabilities remain separate Vector-owned bricks or external-product adapters. Selection of one capability does not add its vocabulary or state to unrelated Vector components.

Each selected capability declares one owner, public inputs/outputs, injected dependencies, finite resources, identity/compatibility contribution, failure/absence/cancellation/cleanup behavior, semantic effects, and complete deletion behavior.

## Composition and package identity

A concrete Vector search package identifies every semantically material input: Vector domain/policy/evaluator/output/UCI versions; state/action/history encodings; optional capabilities and resources; model identity when selected; finite resource/execution profiles; consumed public library identities; and target/toolchain/runtime evidence.

Provider artifacts remain opaque at their owning boundaries. A lower-level library must not interpret positions, moves, UCI commands, model outputs, or product publication policy.

## Independent conformance

Vector acceptance requires independently reproducible product evidence covering legal and illegal moves, transition parity, special moves, terminal/draw/history boundaries, materially different histories for equal boards, collision verification, root restrictions, evaluator mapping when selected, policy/backup invariants, read-only observation, late-bound publication, position changes, finite pressure, cancellation, cleanup, compatibility, and stale-identity rejection.

Framework conformance does not substitute for these chess oracles, and Vector conformance does not become framework authority.

## Non-goals

This proposal does not select one board, move, policy, evaluator, output, model architecture, tensor layout, provider, physical scheduler topology, native backend, or supported production release.

## Production blockers

Production lowering remains blocked until the consumed framework contracts are accepted through public surfaces; Vector's chess Domain and Policy have exact schemas and independent oracles; selected evaluator/model and UCI/publication contracts are accepted; finite resource and authority-change behavior is defined; exact compatible library/package/hardware evidence exists; and deleting Vector leaves every consumed library unchanged and product-neutral.
