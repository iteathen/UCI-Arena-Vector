# Engine-owned evidence runtime

Implementation candidate. No full-engine hardware qualification claimed.

This component owns bounded UCI subprocess measurement, clocks, independent
chess.js 1.4.0 legality and terminal adjudication, complete/partial games,
color-paired measurements and timing samples. It never selects a search move,
evaluates a position, or imports another Vector component. The injected public
managed UCI process owns move computation. Ordinary JS referee checks occur
outside search after `bestmove`.

`cli.mjs --request <absolute JSON file> --output <absolute JSON file>` accepts
only `uci_arena_evidence_request_v2`. The request binds request_id, job_id,
shard_id, workload, target_identity, runtime_identity, runtime_binding, exact
registered launch, campaign and config.
The immutable runtime artifact root supplies
`contracts/evidence-runtime-contract.json`, with `uci_arena_evidence_runtime_v2`
schema. The selected component manifest is the sole regular-file inventory
authority and declares evidence_runtime_contract_v2 plus the named
evidence_runtime_contract entrypoint. The public launch profile schema is
`arena_uci_engine_launch_profile_v1` (standard_uci_v1). Its inventoried Node and
single JS entrypoint use exactly `--experimental-ffi`; no arbitrary launch args,
shell or imported engine internals are accepted. The request's target engine
identity binds the actual executable plus exact arguments/options/working
directory. Runtime identity additionally binds the manifest, contract and
opaque runtime-identity record, including the full JS/libraries/model closure.
`runtime_identity: {path, schema}` declares one inventoried
`contracts/runtime-identity.json` record. The launch profile remains neutral
(`state: conservative`, `expected_runtime: null`) for existing consumers.
The actual `info string vector_identity <JSON>` readiness handshake must match
every fact in that record before measurement; fixture identities fail admission.

Complete games accept a finite opening list (`id`, `fen`, `moves`), integer
`initialTimeMs`, `incrementMs`, `maxPlies`, `responseTimeoutMs`, `maxDurationMs`.
All requests have a bounded whole-request deadline. Games alternate
the selected registered UCI process with declared candidate/control options.
This first profile compares the same exact executable. The referee accepts
only exact UCI coordinate moves, retains history,
and adjudicates checkmate, stalemate, repetition, rule-50 and insufficient
material. Exhausted bounds yield incomplete rather than an artificial draw.
Elapsed command time is charged to the clock before increment; flag fall is
explicit, never a legal terminal proof. Every pre-move FEN, move, clocks and
elapsed measurement is preserved.

Paired games reverse candidate colors for every exact opening. Timing samples
use bounded `go movetime` on explicit positions and preserve requested/elapsed
time and deadline overshoot. These are diagnostic measurements, not qualified
SPRT conclusions or a timing-policy publication. The result's `qualification`
declares unavailable statistical/profile gates. A failed request or move never
produces passing completeness or qualification.

Cancellation requests quit/kill of all owned direct UCI processes in finally;
the Evidence Service still owns outer process-tree isolation and preemption.
Output is atomically renamed. The CLI exits nonzero on failure or incomplete
measurement while preserving
an identity-bound diagnostic result. Package tests prove protocol/referee
semantics only; physical tests must use the exact installed public engine.

The immutable package owner calls the public
`buildRuntimeContract({componentVersion, targetTriple})` export in
`contract.mjs`. It advertises managed-uci-measurements with the inventoried
parameters.schema.json closed finite schema. Manifest inventory rows have
`path`, `sha256`, `size_bytes`. The inventory
includes all JS/Node/dependency/model/identity closure files and the generated
neutral launch profile, identity, parameter schema and generated runtime
contract. The runtime contract does not duplicate the file inventory.
The `chess.js` package and license remain part of
the component runtime closure and package provenance.
# Process retirement observations

The UCI subprocess wrapper gives normal `quit` up to 30 seconds to retire the
owned process, then terminates a nonresponsive child and waits up to five more
seconds for pipe closure. Concurrent close requests await the same retirement.
Its observation records actual exit code, signal, stdio closure, forced disposal
and elapsed time. Forced or abnormal disposal fails the Evidence batch even when
the retained game or timing measurements are otherwise complete. Process exit
facts do not establish joined GPU cleanup; that requires the engine owner's
separate genuine resource and completion observations. Portable protocol fixtures
test this distinction without granting native qualification.

The current Vector adapter requires exactly one bounded
`info string vector_teardown` owner record before normal EOF. It retains this
separately from exit/signal/pipe observations and validates the declared
`vector_engine_teardown_v1` receipt: actual graceful driver closure with zero
live/orphaned resources, zero path/work/backup/request/batch/protection residue,
balanced lease counts, nonzero four-word accepted cancel identity/generation,
and zero declared drain disposition when present. A position-bearing process
must retain a genuine joined game receipt; `noActiveRuntime` can describe only
the current empty owner while preserving and validating retired game receipts.
Missing, duplicate, malformed, inconsistent or non-quiescent owner records fail
the diagnostic batch even if process exit is normal. These checks consume the
public owner record without importing engine/private search code or producing
GPU facts. The exact artifact and readiness identity remain required.

Results retain `process_observations` as additional diagnostic provenance. Their
presence does not alter v2's unavailable timing/strength/publication authority.
An optional bounded `vector_closure_journal_v1` retains at most eight proved
receipts. The consumer checks retained/evicted disposition counts and verifies
the retained SHA chain when its predecessor is available, or from zero when
nothing was evicted. Earlier evicted closures remain owner-declared historical
disposition; a suffix chain never substitutes for individually observed old GPU
resource facts. No empty journal or absent current runtime can supply a joined
game observation on its own.
