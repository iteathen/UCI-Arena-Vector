# Complete CUDA.js UCI Arena Suite Implementation Plan

> **For agentic workers:** Use the existing isolated owner branches and executing-plans workflow. Continue autonomously under the owner's instruction; individual qualification slices are not the final delivery.

**Goal:** Install a working, compatible CUDA.js/MCGS chess engine, Manager, bot, book and evidence services with a functional installer, then start the Lichess bot and verify legal play and clock safety.

**Architecture:** Vector owns chess/model/UCI/publication and composes public MCGS, Tensor and CUDA-JS contracts. MCGS owns generic graph/search/progress; Tensor owns mathematics and callable participation; CUDA-JS owns opaque compiler/native execution/lifetime. The installer consumes signed atomic component payloads and exact version closure.

**Tech Stack:** JavaScript/ESM and restricted Device-JS, Node 26.11.1, public CUDA-JS ecosystem, existing service SDK and signed release tooling.

**Spec:** Accepted VECTOR-0002, accepted CUDA-MCGS SPEC-0007/0008/0010/0011/0012/0015, owning accepted Tensor/CUDA-JS contracts, and explicit owner instructions of 2026-10-08. Concrete additive execution profiles remain scoped candidates until qualification/review; this plan does not promote a proposal or authorize C++ workarounds.

## Global Constraints

- No maintained product C/C++/CUDA C++/PTX/native addon/direct FFI or CPU search fallback. Device and native mechanisms go through public owner libraries.
- After ignition no host-produced active-search transition, legality, features, inference or continuation. Host control, bounded observation, publication, cancellation and teardown retain their declared scopes.
- Preserve historical 54499 evidence. Current 73091 is a separately named producer-selected candidate with the same architecture and feature/action contracts, independently qualified against its exact ONNX reference.
- Preserve user work, installed historical assets and recovery data. No drive cleanup or watchdog/registry change.
- Review and qualify exact source/package/runtime/model/device tuples; retain current immutable evidence once. Use configured owner PR exceptions only after review and applicable checks, with expected-head safeguards.

## Review Focus

- Same legal board with different raw EP/history/model input must not share stale evaluation/publication authority.
- Root changes during evaluation must preserve valid graph knowledge and reject stale move publication.
- Pressure, failed evaluation and cancellation must release each leaf/work lease exactly once; no fabricated successful result.
- Clock deadlines must remain responsive while GPU work is pending; legal final publication is independently fenced.
- Installation must bind actual Node, JS sources, model, libraries and service versions; mixed or tampered payloads must fail before launch.

## Delivery Tasks

1. **Model identity and independent reference** — `tools/latticeknight-successor-*`, `test/fixtures/model-successor/`: exact checkpoint extraction, independent ORT full/partial outputs, public Tensor numerical comparison. Mathematical host qualification is distinct from active device inference.
2. **Chess Domain and model input** — `components/chess-domain/`, `components/chess-model-input/`, corresponding tests: independent legal transition/history/collision/raw-EP proof; exact GPU 17-plane features and 4162-action mapping. Root integrates reviewed commits and keeps hosted/physical coverage separate.
3. **Generic executable search** — CUDA-MCGS canonical Search Compiler `finite-device-search` contribution: actual finite GPU traversal/expansion/backup, policy-owned algebra and full state equality, stale-safe handles/leases/pressure, read-only fenced decisions. Bind normalized owner profiles through the existing Composer/runtime.
4. **Device-closed Tensor callable** — CUDA-JS-Tensor opt-in block32 participation: existing formulas and workspace, uniform one-item group participation and barriers, full/partial model comparison and measured latency. Scalar and resident-sequence profiles retain their original meanings.
5. **Device continuation and control** — CUDA-JS opaque continuation operation: finite kernel DAG, one initial host launch, GPU-owned continuation, generic cooperative cancellation/publication and truthful cleanup. Qualify exact WDDM duration; neither assume watchdog safety nor add a CPU relaunch fallback.
6. **Vector operational UCI product** — `dist/uci.mjs` backed by product lifecycle/controller and composed GPU session: authoritative position/history admission, persistent graph/focus, independent publication timing, legal late-bound `bestmove`, bounded diagnostics, restart/cancel/close. Qualify complete games and clock defect cases with the real package.
7. **Bot and service closure** — Bot1.0.40 standard managed launch via inventoried engine-owned profile, signed Node executable/script integrity; qualify existing Book/Evidence SDK1.2 cohort on exact Node26. Publish compatible immutable service artifacts only after exact-head checks.
8. **Atomic package and installer** — Vector owns `arena-component.json`, `contracts/uci-engine-launch-profile.json`, official Node binary and complete JS/model/library payload. Existing installer entrypoint/component-path bindings supply Bot; existing absolute launch profile supplies Manager. Assemble one fresh signed composition with exact compatible artifacts, leaving legacy engine outside the selected default path.
9. **Installed end-to-end acceptance** — validate staging, transaction, receipt inventories, discovery, startup, reboot/recovery and teardown; verify Manager/Bot/Book/Evidence operation, real legal chess games and timeout safety. Start Lichess bot only against this qualified installed CUDA.js package. Report completion after these checks pass.

## Live Execution Record

- Root integration worktree: `E:/uci-arena-task-builds/vector-engine-delivery-20261008`.
- Public Vector test fix merged as `1cc9503`; all four hosted host/Node combinations passed. Owner exception was already configured; no branch protection was changed.
- Model and chess candidates are integrated locally; Tensor, continuation and MCGS owning branches remain separately reviewed/qualified.
- The installer and live bot have not been switched to the new engine yet. The legacy C++ engine deployment remains cancelled.
- Completion remains pending tasks 3–9; partial proofs are progress, not delivery.
