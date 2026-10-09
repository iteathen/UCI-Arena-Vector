# Separate 180+3 clock-study producer

Status: implemented pure analysis, portable fixtures qualified only as tests.
No native study, reserve, useful-block, policy or rating qualification is issued
by this source change. Historical Evidence v2/continuous-v4 meanings are unchanged.

`clock-study.mjs` performs offline bounded validation and statistical analysis.
It has no file, process, GPU, active-search or service port. Its callers retain
and independently verify actual native receipt provenance; a self-declared
`evidence_class: "native"` does not authenticate physical execution. The producer
checks the complete content and compatible identities after that provenance
admission. Fixture records remain explicitly fixture throughout, and cannot
produce a policy artifact.

## Public calls

- `createClockStudyOrders({openings,treatments,discoverySeed,heldOutSeed})` returns
  immutable complete trial sequences, sampled without replacement. Each seed is
  a recorded different 64-hex string representing 256 crypto-random bits supplied
  before games. The SHA256 counter stream and unbiased rejection draws feed
  Fisher-Yates. The method is `sha256-counter-fisher-yates-v1`; admission recomputes
  the exact order. No random API, clock or mutable driver state is consulted.
- `admitClockStudy({text,sha256}, {runtimeIdentitySha256,referenceIdentitySha256,
  hardwareIdentitySha256})` validates at most256KiB of preregistered JSON and
  returns an immutable branded study handle.
- `analyzeClockDiscovery(handle, trialArtifacts)` accepts the entire discovery
  population, returns an immutable branded report, and selects the smallest
  candidate passing both discovery gates. No candidate yields null selection.
- `analyzeClockHeldOut(handle, discoveryReport, trialArtifacts)` accepts only the
  selected candidate and baseline on the independent held-out openings. A copied
  or edited discovery report cannot supply selection authority.
- `analyzeClockReserve(handle, {text,sha256})` independently recomputes raw reserve
  statistics and validates process/owner closure.
- `produceTimingPolicy(handle, discoveryReport, heldOutReport, reserveArtifact)`
  returns exact `{text,sha256,...bindings}` only after every native selected-data
  and reserve gate passes. It checks the result with the existing public
  `admitTimingPolicy`; it never writes, signs, publishes or installs it.

All game/receipt inputs are hash-bound UTF8 JSON artifacts `{text,sha256}`.
The module snapshots parsed bytes. Accessors are rejected on artifact records.
Each game is bounded16MiB, each split128MiB, and reserve16MiB. Exact randomization
enumerates at most65,536 sign assignments (16 independent opening units).

## Preregistration

The closed `vector_clock_study_v1` object has exactly:

`schema, campaign_id, evidence_class, preregistered_at_ms,
runtime_identity_sha256, hardware_identity_sha256, reference_identity_sha256,
reference_settings, control, rules_profile, transport_reserve_ms, reserve,
treatments, openings, orders`.

Evidence class is `native` or `fixture`. UTC millisecond preregistration time
precedes every trial. Exact runtime/hardware digests identify the compatible
native cohort; the reference digest binds the separately verified signed
Stockfish instrument/configuration evidence. No source identity is guessed from
an engine name. Driver launches and option-setting receipts remain retained.

Control is `{initial_time_ms:180000,increment_ms:3000}`. Rules are
`orthodoxy-live-claims-v1`. Reference settings are exactly:

```json
{"id_name":"Stockfish 15.1","movetime_ms":10,"SkillLevel":0,"Threads":1,"Hash":16,"Ponder":false,"UseNNUE":true}
```

`SkillLevel` projects actual UCI `Skill Level`. This is benchmark-relative
evidence for the declared reference; it supplies no rating claim.

Treatments are ordered three `{id,elapsed_ms,experiment_sha256}` objects with
elapsed0,500,1000 respectively. The first id identifies the no-discretionary
purchase baseline; both candidates select `target_blocks_v1/target_blocks:1`.
The experiment digests are different actual frozen diagnostic artifacts. Book
is disabled and root tablebase binding empty in the actual driver. Neural latency
does not select a candidate. Actual decisions are checked against these bindings.

`openings` contains `discovery` and `held_out`, each8..16 distinct
`{id,fen,moves}` entries. FEN plus full legal replay is independently checked;
Canonical nonterminal board/side/castling/effective-EP root keys and ids must be
distinct across both partitions. Counters or renamed histories cannot turn the
same root into another independent unit; this first profile conservatively
collapses transpositions rather than assuming their independence.
Calibration openings are excluded. Each unit contains both candidate colors,
whose scores are averaged before candidate-minus-baseline differences enter the
existing exact directional paired sign-randomization test. Individual games and
colors never increase the independent sample count.

Each `orders` partition is `{method,seed,trials}`. Trial items are exactly
`{trial_id,opening_id,treatment_id,candidate_color}`. Discovery contains all three
treatments/colors. Held-out contains the actual baseline id and the literal
`selected` placeholder, resolved only to the frozen discovery winner. Generated
ids are `discovery-000`/`held_out-000`, then increasing zero-padded order indices.
Driver records bind that sequence, not a reordered convenient subset.

Study `reserve` is exactly `{sha256,local_publication_reserve_ms,
measurement_protocol_sha256,supported_scopes,thresholds}` and pins the separate
receipt described below. `transport_reserve_ms` retains its separate meaning.

## Game envelope and replay gates

Each closed `vector_clock_study_trial_v1` envelope has exactly:

`schema,evidence_class,study_sha256,partition,trial_id,order_index,opening_id,
treatment_id,experiment_sha256,runtime_identity_sha256,reference_identity_sha256,
hardware_identity_sha256,started_at_ms,completed_at_ms,reserve_scope,
candidate_close,reference_close,game`.

Actual UTC start/completion times follow the preregistered sequence; a completed
joined game precedes the next start. Held-out starts after discovery completion.
`game` is the complete existing `vector_clock_experiment_game_v1` result, with
all per-move `records[].info` retained. Complete/legal booleans alone cannot pass:
the independent referee replays every move/FEN/turn and verifies the final real
terminal/result. Flags, illegal moves, failures, max-ply and duration bounds fail.
Actual clocks start180000 and charge measured elapsed before the3000 increment;
every charged clock stays positive. Every charged candidate clock retains at
least local-publication plus transport reserve. Actual final clocks remain in
the original hash-bound receipt, separate from acceptance floors.

Every searched candidate move carries exactly one actual
`info string vector_timing_experiment` decision bound to experiment SHA, current
remaining/control/reserve/focus and full purchased block. Matching diagnostic
`vector_clock_phase` rows retain goReceived/publicationRequested/emit ordering.
goReceived.time is the actual captured scheduler start. The minimum deadline
check uses `requested < go + declaredDeadline` with the scheduler's represented
addition; floating subtraction is not substituted, and no tolerance is added.
No decision is allowed only when independent canonical legal replay identifies
a sole legal move; this exception never manufactures a zero useful block.

Candidate close is the public `vector_uci_process_close_observation_v1`, with
normal exit0, no signal/force and closed stdio, plus `validated` genuine joined
`vector_engine_teardown_v1`. The existing independent teardown consumer verifies
GPU resource/path/request/batch/protection residue, balanced leases and actual
cancel identity. This selected current cohort additionally requires every
joined retained footer's first authoritative stopCause2 (external cancellation)
and independent drainDisposition0. Later clean drain cannot replace an earlier
failure cause. Historical Evidence v2's public validator remains unchanged.
Reference process close is normal with no GPU owner requirement.
These source checks do not manufacture driver facts from process exit.

## Statistical selection

Discovery requires mean score gain>=.05 and raw directional p<=.025 for each
candidate (Bonferroni2; corrected p is separately reported). Select the smallest
passing elapsed candidate. No selection means no held-out or policy artifact.
The independently selected held-out comparison requires mean>=.05 and p<=.05.
Failure never tries the other candidate on held-out data. Reports retain exact
preregistration and complete-population digest identities. Only native records
passing all gates may yield the existing `vector_timing_policy_v1` policy with
one selected useful block, target1, supported180+3 and publish-current fallback.

## Separate reserve receipt

Closed `vector_clock_reserve_measurement_v1` fields are exactly:

`schema,evidence_class,runtime_identity_sha256,hardware_identity_sha256,
measurement_protocol_sha256,clock_domain,local_publication_reserve_ms,
supported_scopes,thresholds,process_closures,calibration,held_out`.

Clock domain is exactly `node26-windows-qpc-ns-v1`. Actual measurement protocol
bytes bind independently source-pinned Node26.11.1/libuv Windows system-QPC
mapping and empirical cross-process ordering. Child and receiver retain direct
`process.hrtime.bigint()` readings as canonical nonnegative decimal strings,
bounded by unsigned64-bit. Neither `timeOrigin+now` nor clockOriginUtcMs supplies
measurement authority; their naive conversion was experimentally rejected.
No offsets, clamps or floating epoch subtraction are permitted. This is final publication
request→emit→received latency; admission and already elapsed thinking remain
separately charged against the game envelope, not mislabeled local reserve.

There are1..32 named supported scopes and thresholds `{p99_ms,maximum_ms}` with
0<p99<=maximum<=local reserve. Root's selected reserve100/p99<=80/max<=100 is
distinct from historical v4 overshoot thresholds10/50, whose meaning is preserved.
Both calibration and held-out contain30..4096 observations per scope, each:

`{id,scope_id,process_id,root_epoch,request_id,publication_requested_ns,
emitted_ns,received_ns}`.

Timestamps are literally BigInt ordered. Durations are subtracted before Number
conversion to milliseconds; the difference is bounded by the declared reserve
before conversion. IDs, physical process/root/request identities and
per-process request timestamps are unique across partitions. Every process id
references exactly one of1..256 `{id,process_close}` entries; every retained
closure is used and meets the same genuine joined candidate close gate. There
are no arbitrary passed flags. Nearest-rank p99 and maximum of received-requested
are recomputed separately per scope and partition and compared with every
declared threshold/reserve. Receipt bytes and runtime/hardware/protocol identities
must match preregistration. Missing evidence keeps policy output unavailable.

## Source verification

`node --test components/evidence-runtime/test/*.test.mjs` exercises only portable
fixtures, including legal game replay, correction boundary, seeded order,
missing decisions, residual/flag/closure rejection, reserve overlap and fixture
output denial. It writes no policy artifact. Actual preregistration, native
games, reserve capture, independent source review, release and installation stay
separate owner work.

Source verification on Node26.11.1: the complete Evidence suite passes46 tests,
including16 new producer falsifiers; the existing timing consumer suite passes20
tests. Repository policy and diff checks pass. No native games, signed receipts,
policy artifacts or physical qualification are generated by those tests.
