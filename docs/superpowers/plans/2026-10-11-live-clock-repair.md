# Live clock repair implementation plan

**Goal:** Prevent the recorded first-legal-seed play and supply an empirically qualified policy for the bot's 180+0 control.

**Architecture:** Timing remains downstream of continuous cuda-js/MCGS search. A managed launch explicitly requires compatible timing evidence and actual initial-control facts. Diagnostic unconfigured/explicit-movetime behavior remains separate. No publication-time GPU wait, CPU search, or invented production delay is introduced.

**Authority:** `components/move-timing/contract.md`, `components/evidence-runtime/clock-study.md`, and the engine-owned move-time applicability, persistent-search and late-bound-decision contracts.

- [x] Reproduce archived game pVk99uqh on the signed 0.1.2 engine: live clock emits b1a1 with zero evaluated/backup work; diagnostic movetime permits evaluated search and returns e2d4.
- [x] Add failing readiness tests; require an admitted policy and matching initial control for managed launch before position admission. Preserve explicit diagnostics and deadline memory reads.
- [x] Admit a separately declared 180+0 evidence study; validate its actual increments, clock recurrence and decisions without relabeling 180+3 trials.
- [ ] Freeze/review the implementation and run the existing native reserve/discovery/held-out producer with current exact source/runtime identity and independent Stockfish instrument.
- [ ] Admit only a producer-qualified policy; replay the archived failures and verify completed search evidence, deadline reads and joined cleanup.
- [ ] Build the signed corrected component and bind policy/actual control to the stopped bot configuration. Keep the bot stopped unless the owner requests restart.

Native study failure or insufficient benefit yields no profile. Synthetic fixtures and the ten-second diagnostic are never production policy authority.
