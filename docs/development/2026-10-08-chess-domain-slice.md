# First physical chess Domain slice

Owner-authorized objective: qualify actual GPU chess legal moves and transitions through public CUDA-JS. This is a bounded Domain qualification, not a complete engine, search policy, scheduler, model integration or MCGS session.

Hard constraints: ordinary Node JavaScript plus restricted Device-JS; no maintained C/C++/CUDA C++/PTX/native addon/direct FFI; no CPU active-search fallback; no private library imports. Host FEN admission and independent chess.js qualification are permitted. Preserve original worktrees, fixtures and source.

New owned files:

- `components/chess-domain/contract.md`: exact resident state/action/status/history identity and finite limits.
- `components/chess-domain/admission.mjs`: FEN/history admission, action/result decoding. No search.
- `components/chess-domain/device.mjs`: restricted Device-JS legality/transition/terminal/history functions and public compile metadata.
- `components/chess-domain/runtime.mjs`: injected public CUDA-JS compilation, bounded input/scratch/output memory, launch, terminal read and dependency-ordered cleanup.
- `components/chess-domain/package.json`: isolated exact dependency manifest, without changing root tooling.
- `test/chess-domain/domain.test.mjs`: independent chess.js 1.4 oracle, special move/terminal/history and failure boundaries; actual GPU differential runner.

The state uses a 64-square u32 mailbox (a1=0), piece ids 1..6 white and 7..12 black, separate u32 side/castling/EP/halfmove/fullmove fields. Actions use from/to/promotion only; special effects derive from state, eliminating contradictory historical flags. History carries full repetition positions, not unverified hashes. State equality includes exact history and rule-50 fields; hash collision never authorizes reuse.

Sequence: failing admission/API test; admit validated complete FEN/history; failing physical differential test; implement/check restricted Device-JS; run bounded GPU cases with public library compiler/runtime; qualify every legal transition and terminal boundary against independent chess.js; record exact runtime/dependency/evidence/cleanup identities. Reuse accepted MCGS SPEC-0007 Domain obligations and frozen producer orientation/action meaning, keeping model-invisible halfmove/repetition search-owned.

Acceptance: start position, checkmate/stalemate, castling start/transit attacks, en-passant discovered check, four promotions, rule-50 and distinct repetition histories, buffer pressure and invalid admission. No active CPU-produced intermediate. Root graph integration consumes the documented state/action layout after this Domain gate.
