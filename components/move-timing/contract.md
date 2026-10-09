# Diagnostic clock experiment port

This owner controls only publication waiting. It does not import search, chess,
model, knowledge or GPU components. `admitTimingExperiment(text, {sha256,
runtimeIdentitySha256})` accepts at most 16 KiB of exact hash-bound JSON and
returns an immutable admitted handle. `decideExperimentalPublication(handle,
input)` returns an immutable decision bound to the current protocol focus and
publication request. Callers cannot forge an admitted handle.

`vector_timing_experiment_v1` is explicitly diagnostic. All qualification fields
must be false. Candidate elapsed blocks are treatments to measure; they are not
qualified minimum useful blocks. This API cannot admit a production timing policy
or authorize Bot activation. Existing v2 evidence and original continuous-v4
qualification meanings remain unchanged.

The frozen experiment binds a campaign, exact runtime-identity byte digest,
`orthodoxy-live-claims-v1` rules, increment regime, initial control, local output
reserve, candidate elapsed blocks, and one of two declared trial strategies.
`target_blocks_v1` buys at most its declared target count. The separate
`preserve_future_blocks_v1` candidate additionally reserves the declared number
of future full candidate blocks plus per-publication reserves, reduced only by
the separately supplied increment. These are experimental formulas with no
population-benefit authority.

An explicitly frozen `target_blocks: 0` treatment is the no-discretionary-purchase
baseline. Its reason is `baseline_no_discretionary_purchase`; it is not a zero
useful block. Search is already continuous and publication still incurs actual
admission/observer/emission latency. Resolved knowledge moves remain a separate
inapplicable class and cannot contaminate that searched baseline.

The campaign supplies its actual initial control separately; remaining clock
cannot identify that control after moves and increments. The producer checks
this context against its own immutable request, and admission requires an exact
match before any search-time treatment. UCI remaining clock alone supplies no
initial-control proof.

Current remaining clock, explicit maximum when present, local output reserve and
external transport reserve form a hard envelope. Already elapsed admission and
knowledge time consume it. A new treatment buys a whole additional candidate
block or publishes immediately; it does not invent a partial useful block.
When elapsed work already exceeds the envelope, the deadline is immediate and
reports zero discretionary purchases. No hard envelope can remove unavoidable
latency that already occurred. A resolved current-focus move bypasses allocation.
Unsupported increments and authoritative moves-to-go fail closed in this first
profile; they are not silently substituted. A normal remaining-clock launch
without explicit experimental admission continues to require a qualified policy.

Decisions preserve applicability, clock inputs, both reserve authorities, safe
envelope, candidate purchases, reason and experiment identity separately. The
deadline is measured from command receipt; scheduling subtracts elapsed time
once. These facts do not change persistent search behavior or lifetime.

The explicit diagnostic CLI launch supplies all four pairs:
`--timing-experiment <absolute-file>`, `--timing-experiment-sha256 <sha256>`,
`--experiment-initial-time-ms <actual-campaign-control>`, and
`--experiment-transport-reserve-ms <declared-reserve>`. Incomplete, duplicate or
unknown arguments fail closed. The cold file loader admits a regular file of at
most 16 KiB, checks the opened identity and extent, and closes its descriptor.
The controller compares artifact identity to the actual backend readiness record
before any trial. This explicit launch is not the standard managed launch
profile, which continues to carry no experimental authority. Every allocation
emits a bounded `vector_timing_experiment` record; source and options remain part
of the exact trial identity. New-game initialization rechecks the actual backend
identity rather than carrying authority to a changed runtime.

A `ponderhit` received during pending position admission or publication-intent
classification captures its clock start immediately. Allocation waits for that
classification, counts elapsed time since the hit once, and preserves resolved
move bypass and infinite/stop gates. An already requested publication cannot
acquire another allocation timer. These are protocol deadline facts only.

## Production consumer

The distinct `vector_timing_policy_v1` reader consumes producer-qualified
allocation, useful-block, reserve and discovery/held-out declarations. These
declarations are an interface, not completed qualification. No test fixture is
eligible for packaging or Bot activation. The producer must retain the actual
study and exact evidence digests; runtime admission also binds the complete
artifact bytes and actual backend runtime identity.

The production launch advertises timing-owned startup options `TimingPolicyFile`,
`TimingPolicySha256`, `TimingInitialTimeMs` and `Move Overhead`. The adapter admits
the bounded regular file before a game, never forwards these options to search,
and performs no file access on publication. Both artifact and digest are
required together. Remaining-clock operation without an admitted policy remains
unsupported unless a configured authority has already resolved the exact move.

An independently supplied initial control is required for supported block
purchases; zero means unknown. Unknown control, unsupported increment or
authoritative moves-to-go use the artifact's explicit `publish-current` fallback
without asserting useful-block authority. Current remaining clock and explicit
maximum still bound feasibility. `Move Overhead` retains external transport
reserve meaning, separate from the producer's local publication reserve.

Production decisions emit a bounded `vector_timing_policy` record with exact
policy, focus, clock, reserve, applicability and publication reason. Explicit
movetime-only commands retain their ordinary protocol meaning. Diagnostic
experiment and production policy launches are mutually exclusive.

An optional neutral `subscribePublicationResolution({rootEpoch,requestId},
listener)` port returns one owned unsubscribe handle. Its exact current-focus
`resolved:true` event cancels only the remaining allocated publication wait.
Ponder and infinite commands retain their external publication gates. Replayed
completion, stale callbacks, replacement, new game and shutdown are fenced;
subscription release failures still allow backend closure and fail the aggregate
teardown. The timing layer neither selects the resolved action nor changes search.
