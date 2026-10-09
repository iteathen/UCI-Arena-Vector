# Orthodox chess mailbox Domain v1.2

This owner-authorized first implementation realizes bounded chess Domain legality/transition/history through restricted Device-JS and the public `cuda-js` package. It qualifies Domain behavior only. It does not implement an engine, graph, search policy, scheduler, persistent session, UCI adapter, model or producer feature mapping.

## Resident state and action

`vector.chess-mailbox-u32/1.2.0` uses 17,223 little-endian u32 words (68,892 bytes), aligned to at least 4 bytes. Squares are a1=0, h8=63. Piece ids are none=0, white P/N/B/R/Q/K=1..6, black=7..12. Side is white=0, black=1. Orthodox K/Q/k/q rights use bits 0/1/2/3.

| Word | Meaning |
| --- | --- |
| 0..63 | Mailbox piece ids |
| 64 | Side to move |
| 65 | Castling rights |
| 66 | EP square 0..63, or 64 absent |
| 67 | Exact halfmove clock |
| 68 | Exact fullmove number, positive |
| 69 | History count 1..256, including current position |
| 70 | Original raw EP square 0..63, or 64 absent; producer-feature-visible |
| 71 onward | 256 records of 67 words: mailbox, side, rights, effective EP |

Input admission accepts complete six-field FEN and an authoritative chronological history ending at that position. A FEN alone initializes a one-record history; it does not prove absence of earlier repetitions. The caller owns whether that is valid initial-game authority. Four-field model records cannot supply omitted rule-50/history facts. History is not reconstructed from model features.

Device normalization preserves effective EP at word 66 only when a legal EP capture exists, including king-exposure checks. Every history record gets that normalization. Raw EP at word 70 remains untouched by normalization and is retained/set/cleared by exact transition rules independently. It affects model input and therefore full state/cache identity and equality; it does not enter repetition identity. Halfmove and fullmove remain exact in transition/output. The unused history tail is outside semantic equality and key generation. It is not observable product evidence.

The v1.0 receipt/commit are immutable historical Domain-only qualification. A physical producer-feature counterexample showed that e2e4's uncapturable raw e3 target and a pinned EP target still set the producer EP plane. v1.1 is the coherent state-schema extension required for exact producer interop; reinterpreting v1.0's discarded raw EP as absent model input is forbidden.

Actions are u32 with from in bits 0..5, to in bits 6..11, promotion in bits 12..14: 0=none, 1=N, 2=B, 3=R, 4=Q. Higher bits reject. Captures, double pushes, castling and EP derive from the originating state. No legacy flag encoding is consumed. Origin state/profile identity must fence downstream action reuse; the packed action alone is not global action authority.

## Relevant history in v1.2

The owner-authorized v1.2 candidate keeps the exact word layout and model-visible board/clock/raw-EP fields. After an actual pawn move, capture (including EP), or loss of any castling right, `cApply` retains the new current record and discards only the irreversible prefix from semantic history. Every subsequent reversible record remains present; no age/window/clock-based truncation is permitted. Castling-right loss does not reset the fifty-move clock. Identity/equality include the complete retained relevant sequence and exact clocks/raw EP; unused tail bytes remain nonsemantic.

Cold admission accepts up to 4096 authoritative chronological complete FENs and derives the same suffix from exact pawn placement, decreased material count, and lost castling rights. It rejects a relevant suffix exceeding 256 records. No active transition, legality, feature, evaluator or search result is generated on the host. A full relevant buffer rejects a reversible transition; an irreversible transition can reset it without losing repetition authority.

Domain 1.1 is retained under `archive/contract-v1.1.md` with archival metadata. Its prior source/profile/physical records remain historical. Current namespace is `vector.chess-mailbox-u32/1.2.0`, qualification package 0.2.0 and exact CUDA-JS alpha.22 protected `dc2924657bb900cdce3fba4c9def62934419db03`. This version does not reinterpret the older receipts.

Physical Node 26.11.1 replay passed 300 externally supplied independently legal plies, every header/repetition/key and final used-state byte, with maximum relevant history 11. Pawn/capture/rights-loss boundaries and reversible repetition cycles passed separately. The first diagnostic raw-EP mismatch was an independent fixture omission: raw targets are now derived from independently validated double-pawn moves while effective EP still follows the chess.js legal oracle. Receipt `E:/uci-arena-task-builds/vector-model-parity-evidence-20261008/domain12-history-qualified-observation.json` records source/artifact/device identity and graceful zero-live/orphan cleanup. The full native suite passed 14 tests with 28 independent positions and 489 transitions; `domain12-full-native-observation.json` and `domain12-boundary-receipts/` retain those observations. Engine live draw adjudication is a separately selected product profile; the historical qualification kernel's automatic fifty-move/threefold convention does not authorize a live foreground null move for claimable-only draws.

## Public callable contribution

`buildDomainDeviceModule()` returns product-owned restricted source and explicit function metadata, containing only device functions. `buildDomainProgram()` adds the independent qualification kernels. No generated native source/artifact is maintained.

All `s`, `d`, `scratch`, `other` values below are `ptr<u32>`; base offsets, square/action/color values are u32. There are no raw native pointers in the host API.

- `cValidBoard(s, base) -> bool`: bounded board/side/rights/EP validation, one king per color and nonmoving-king safety. The caller separately admits the 70-word header, history count and exact current-record fence.
- `cLegal(s, base, scratch, sb, from, to, promotion) -> bool`: exact action legality, including start/transit/destination castle safety and EP discovered check.
- `cApply(s, base, d, db, scratch, sb, action) -> u32`: validates action and writes the child only with status 0. Status 1 invalid action, 3 history exhaustion, 4 clock overflow. Partial bytes on failure have no publication authority.
- `cAttacked`, `cKing`, `cInsufficient`: bounded domain truth primitives.
- `cNormalizeHistory(s, base, scratch, sb) -> void`: pre-use canonicalization of the exclusively owned admitted root/history. It is not safe to mutate a shared/published node.
- `cRepetitions(s, base) -> u32`: exact matching canonical records.
- `cIdentity(s, base) -> u32`: FNV key over header and used history. This is a lookup hint; collision cannot grant reuse.
- `cEqual(s, base, other, ob) -> bool`: exact used-state/history comparison, required after a matching key. Different relevant histories/clocks remain distinct.

Before calling the primitives, the graph/runtime owner must validate complete state extents, 1..256 history count, all board records, positive fullmove, the raw EP range/geometry/pawn and exact current-record fence. Storage is nonaliasing: `s` is a full 17,223-word state; `d` is another full state; scratch has 71 exclusive u32 words per concurrent call. `cApply` never allocates, schedules, mutates graph statistics, evaluates a model, backs up a result or publishes a product move. Caller owns publication after successful status and synchronization.

## Terminal and pressure behavior

The qualification profile prioritizes no-action checkmate=1/stalemate=2, then rule-50 draw=3, threefold=4, insufficient material=5; active=0. Side to move and terminal reason are retained; no policy value/perspective is selected. This first profile treats the 50-move/threefold facts as terminal draws, matching the existing product behavior and selected chess.js oracle. Other claim/automatic-draw profiles require explicit product authority.

Enumeration admits at most 256 actions. Status 2 means output capacity pressure and count 0; status 3 history exhaustion and status 4 clock overflow also publish zero children. It never truncates a valid move set into success. A history-full reversible position requires more admitted capacity; only the proven irreversible boundaries described above can discard a prefix. Clock increments never wrap.

The qualification kernel allocates a finite 17,706,584-byte device footprint: one input state, 71-word scratch and 8-word result header plus 256 action/full-child slots. Header words: status, count, in-check, terminal, repetitions, halfmove, identity key, reserved. Result children carry exactly the declared state stride; capacity/offset access is bounded. Each independent root executes one thread, reads only after completion and closes operations/functions/modules/memory/runtime in dependency order. Failure to prove cleanup stops downstream direct release and reports failure; CUDA-JS retains teardown truth.

## Producer boundary

The frozen producer uses `[N,17,8,8]`, black-to-move rotate-180/color-swap and `from_to_4096_plus_underpromotion_source_file_major_v1`. This Domain retains absolute-square actions and all rule/history state. It does not redefine the producer action index or fabricate model-invisible halfmove/repetition. A later device feature/action adapter must prove those exact transforms independently.

## Reproduce

From this repository, install with `npm ci --ignore-scripts --no-audit --no-fund --prefix components/chess-domain`. Run `node --test test/chess-domain/domain.test.mjs` for admission/frontend checks. For actual CUDA execution set `VECTOR_CHESS_NATIVE=1` and run `node --experimental-ffi --test test/chess-domain/domain.test.mjs`. Optional `VECTOR_CHESS_RECEIPT` names a new append-only JSON evidence path; existing receipts reject overwriting.

The capsule uses exact `cuda-js@0.1.0-alpha.22` revision `dc2924657bb900cdce3fba4c9def62934419db03` and independent `chess.js@1.4.0`. Current evidence covers the executed Windows/GTX1660Ti/CUDA13.3/Node profile only and does not promote library native-support projections.
