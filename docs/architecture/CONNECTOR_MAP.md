# UCI Arena Vector Connector Map

**Status:** Active architecture plan  
**Purpose:** Identify every cross-component seam required for a functional GPU-resident UCI Arena Vector engine and assign exactly one semantic owner.

## System map

```text
                         UCI client / Arena / Lichess
                                  |
                                  v
                           UCI Arena Vector
                                  |
       +--------------------------+---------------------------+
       |                          |                           |
       v                          v                           v
 Book Forge adapter       Timing-policy adapter       Tablebase adapter
       |                          |                           |
       v                          v                           v
 published snapshot       qualified policy/profile      tablebase resources

                                  |
                                  v
                    Vector product composition
        chess Domain / Policy / model / output modules
                                  |
                                  v
                              cuda-mcgs
                 universal MCGS semantics/progress
                        |                     |
                        v                     v
                     cuda-js           cuda-js-tensor
                        ^                     |
                        +---------------------+
                                  |
                                  v
                             selected GPU
```

## Priority legend

- **P0** — required for the first functional GPU-resident engine.
- **P1** — required before suite/live promotion but may follow the first local functional engine.
- **P2** — optimization or optional capability after correctness.

## P0 connector 1 — Vector -> CUDA-MCGS product specialization

**Owner:** Vector.

Vector supplies product-owned modules through public CUDA-MCGS contracts:

- chess state/action/history/terminal Domain semantics;
- chess selection/backup/root-output Policy semantics;
- evaluator input/output semantic mapping;
- product observations/results;
- initial root and root-control interpretation.

CUDA-MCGS must not gain chess fields, move encodings, UCI rules, book semantics, tablebase semantics, model-head semantics or Vector product defaults.

### Acceptance

- differential parity against an independent authoritative chess oracle;
- same board with materially different relevant history stays distinguishable;
- no CPU-produced chess transition/legality result after ignition;
- deleting Vector leaves CUDA-MCGS unchanged.

## P0 connector 2 — CUDA-MCGS -> CUDA-JS runtime adapter

**Owner:** CUDA-MCGS issue #125.

One `integration.cuda-js` LEGO translates normalized CUDA-MCGS execution packages into public CUDA-JS contracts. Graph/Policy/Evaluator/Progress owners do not deep-import CUDA-JS or invent CUDA mechanisms locally.

### Acceptance

- public package contracts only;
- finite pre-ignition resource admission;
- target-correct Device-JS program/library identity;
- device publication/order semantics use CUDA-JS-owned helpers;
- exact failure/cancellation/cleanup mapping;
- no CUDA-MCGS native escape path.

## P0 connector 3 — CUDA-MCGS evaluator -> CUDA-JS-Tensor

**Owner:** CUDA-MCGS issue #124, consuming public CUDA-JS-Tensor.

CUDA-MCGS owns request accumulation, batch compatibility, incarnation, scatter, readiness/publication, pressure and cancellation. Tensor owns only dense mathematical execution and callable ABI/workspace.

### Acceptance

- multiple device-owned evaluator requests progress without host inference control;
- full/partial batches preserve request identity;
- Tensor failure has typed evaluator/search disposition;
- non-Tensor evaluator deletion remains complete.

## P0 connector 4 — Vector model semantics -> Tensor evaluator program

**Owner:** Vector.

Vector owns model package identity, feature semantics, action-index mapping, policy/value/other head meaning, parameter provenance and numerical equivalence. It translates those facts into a public TensorProgram and product-owned Device-JS encoder/output mapper.

### Acceptance

- no host feature generation or host Tensor submission per evaluator request after ignition;
- public Tensor/CUDA-MCGS imports only;
- exact model-oracle parity within declared tolerance;
- multi-head outputs remain typed rather than forced into one scalar.

## P0 connector 5 — Vector UCI/session control -> CUDA-MCGS Search Session

**Owner:** Vector, consuming CUDA-MCGS public session/control contracts.

Because Vector is Node-hosted, there is no native-to-Node search bridge. UCI commands map directly at the product boundary to generic root/session operations.

Conceptual mapping:

```text
new game / game replacement -> create/replace product session
position initial root        -> establish initial root
played ready successor       -> minimum-work advance when legal
unrelated/replaced position  -> general reroot/replacement
ponder/emphasis              -> product control/attention where selected
stop                         -> publication/cancel semantics, not hidden host search progression
quit                         -> terminal close
```

### Acceptance

- no `go`-scoped recreation required by architecture;
- no observation -> host decision -> search-control loop required for internal progress;
- stale root/control generations fail closed;
- UCI `searchmoves` remains product root authority.

## P0 connector 6 — Vector -> Book Forge opening-book snapshots

**Owner split:** Book Forge owns the published snapshot contract; Vector owns consumption and policy.

Book Forge currently publishes `opening_book.snapshot` with `snapshot_schema: uci_arena_book_snapshot_v2`, but its output schema hard-codes `consumer_component_id: uci_arena.engine`. That is a real connector gap for an independent Vector product and must be fixed at Book Forge's public contract rather than by making Vector impersonate the existing Engine.

Vector owns:

- snapshot admission/identity validation;
- game-latched immutable generation;
- chess/product opening policy;
- resolved book-move publication/bypass;
- optional hint/prior mapping into product policy.

### Acceptance

- Book Forge contract admits independent conforming engine consumers through a neutral compatibility contract;
- Vector never imports Book Forge internals;
- CUDA-MCGS never parses book artifacts;
- a resolved book move may bypass GPU search;
- hints/priors do not silently gain direct publication authority.

## P0 connector 7 — Vector -> Timing Evidence policy

**Owner split:** Timing Evidence Service owns population evidence, qualification and immutable policy/profile publication; Vector owns live applicability and allocation.

Vector combines:

- authoritative current game clock/protocol facts;
- qualified timing-policy/useful-block artifacts;
- bounded read-only current search observations where the policy declares them.

Timing determines **when Vector samples/publishes a search-derived decision**. It never directs CUDA-MCGS selection, depth, topology, queues, evaluator batches or worker scheduling.

### Acceptance

- exact artifact/runtime compatibility validation;
- search-resolved/book-resolved/tablebase-resolved applicability remains product-owned;
- no policy mutation during an active game;
- old artifact semantics remain versioned;
- CUDA libraries contain no Timing Evidence schema or service identity.

## P0 connector 8 — Vector -> endgame tablebases

**Owner:** Vector for chess/tablebase meaning; generic implementation gaps route to libraries.

Required first profile:

- admit exact tablebase resource identity before game/search use;
- resolve exact root moves or WDL-safe root constraints at the product boundary;
- preserve repetition/rule-50/history/DTZ/WDL orientation and `searchmoves` restrictions;
- prevent ordinary GPU search from degrading an established exact result class.

A CPU tablebase callback from an active GPU leaf is forbidden because it would create a CPU-produced search intermediate.

If internal tablebase acceleration later appears valuable and requires native mechanisms, apply the native-code diagnostic: identify the missing generic library capability instead of adding native code to Vector. Product-specific tablebase semantics stay in Vector even when a generic storage/access mechanism is added elsewhere.

### Acceptance

- root tablebase resolution works with GPU search selected;
- no internal search waits on a CPU tablebase oracle;
- exact tablebase result authority cannot be widened/degraded;
- tablebase-resolved moves are timing-not-applicable for search-time allocation;
- absence/miss/not-applicable/deferred remain distinct.

## P1 connector 9 — Vector -> Manager / Installer

**Owners:** Vector publishes its component/release contracts; Installer composes suite releases; Manager consumes registered component contracts.

Vector needs its own component id, version, executable/CLI/health interface, dependencies, exact library compatibility, model/resource requirements and release evidence. It must not reuse `uci_arena.engine` identity merely for compatibility.

## P1 connector 10 — Vector -> Lichess / match / evidence consumers

Vector is a UCI executable. Lichess Bot and match/referee tooling consume UCI and published telemetry/evidence contracts, never Vector internals or CUDA library internals.

## P2 optimization lanes

Not first-functionality blockers unless representative evidence changes the dependency graph:

- CUDA-JS-Tensor result-owned material arena;
- strided-batched/typed cuBLASLt;
- f16/bf16 and Tensor-Core profiles;
- cuBLASDx/CUTLASS fusion;
- CUDA Graphs/cooperative execution;
- multi-GPU execution;
- internal GPU-resident tablebase cache/proof structures;
- prospective/speculative evaluator strategies.

## Native-code escalation matrix

When Vector appears to need native implementation, classify the need before code:

| Need | Owning place |
|---|---|
| generic CUDA memory/operation/sync/compiler/library mechanism | `cuda-js` |
| generic tensor/dense math | `cuda-js-tensor` |
| universal MCGS lifecycle/graph/evaluator/progress semantic | `cuda-mcgs` |
| chess/UCI/model/book/timing/tablebase meaning | Vector JavaScript / restricted Device-JS or published external contract |
| no natural owner without distortion | architecture gap; plan before implementation |

Vector never gains a local native escape hatch.
