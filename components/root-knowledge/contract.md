# Vector root opening-book consumer

This JavaScript module implements the root opening-book portion of the original
`uci_knowledge_sources_v1` version 1.4 and Vector's accepted native boundary.
It is not a CPU search, evaluator, legality fallback, or Book Forge implementation.
Public dependencies are `chess.js@1.4.0` for replay of the external root input and
`@echecs/zobrist@1.0.2` for the published Polyglot hash convention.

`admitBookSnapshot(files)` admits the exact configured files without path discovery
or substitutes. Records are sorted and unique. Admission validates finite file,
entry, line, and record bounds before materialization; one 16-byte record buffer
and a fixed 64 KiB I/O chunk populate the typed entry store. Cold processing yields
between chunks. Statistics match every key/move and exact base-file FNV digest.
All configured activated files match the adjacent v2 manifest's SHA-256 digests.
Unknown/duplicate/invalid policy keys and partial sidecars reject admission.
Configured role basenames cannot alias, so every activated artifact retains its
own digest. Exit coefficients preserve the specified evaluation direction and
finite arithmetic throughout the declared clamp range; worsening evaluation
cannot increase the exit probability. Selection reports that probability.
The manifest identity covers its exact bytes. A base-only explicit file retains
the original FNV identity and never claims statistics from Polyglot weights.
Manifest qualification flags are reported producer provenance, not independent
consumer strength qualification or permission to install an unsigned artifact.

`createBookProvider()` serializes reloads. A failed unchanged configuration retains
the previous complete snapshot and reports the failure; a changed configuration
retires that selection before admission. Entry admission accounts for the active
snapshot, the single pinned game's snapshot, and the candidate under the original
128 MiB transactional budget. `newGame(options)` returns one immutable selection
handle. Its idempotent `close()` releases that game reference. The product calls
reload at startup, explicit configuration changes, and before each new game;
ordinary moves do not reload files. A reload cannot change an existing game.

`game.resolve({context, searchmoves, evaluationCp, tablebaseEligible})` consumes
`vector_root_knowledge_context_v1`: external origin FEN and complete packed moves,
the GPU's complete canonical legal actions, root epoch, and four-word native
arena/slot/generation/focus fence. Independent replay computes only the book key
and standard castling decoding at this root-provider boundary. It never supplies
position, transition, feature, or legality intermediates to active GPU search.
Only actions in the canonical GPU set and publication restrictions can resolve.
Tablebase-eligible roots bypass Book selection. Hints are not implemented and
cannot acquire publication authority through this API.

Base selection makes exactly one weighted roll. Statistical selection computes
the specified sibling posterior/LCB, quality and rarity weights across legal book
siblings, then intersects the eligible set with `searchmoves`. It makes one
selection roll and one dynamic-exit roll. An exit is latched for that game. Seed
zero samples one seed; nonzero seeds reproduce the per-game sequence.

The statistical exit formula uses engine-side centipawn evaluation when an
immediately compatible completed evaluation has already been admitted by the
product. The current neural profile declares utility, not centipawns. The original
2026-07-20 latency addendum explicitly permits neutral zero centipawns when no
compatible evaluation is ready. Selection reports `neutral_latency_fallback`
separately from `compatible_completed_evaluation`, never starts or waits for
evaluation work, never converts neural utility into centipawns, and never ignores
valid statistical sidecars. Nonfinite supplied evaluations fail closed.

Every resolved result carries its unchanged root fence and snapshot identity.
The product must revalidate the focus before emitting the move and bypass only
the remaining publication wait. Root knowledge does not stop or reset the
continuous MCGS search. Missing/invalid data, no eligible move, maximum ply,
and dynamic exit are explicit dispositions.

This module's portable tests are not installation, population strength, live
clock, or complete-game qualification. UCI/Manager integration remains separately
qualified against the exact installed payload and selected provider artifacts.
