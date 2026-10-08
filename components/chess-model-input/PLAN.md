# Device model-input slice

Owner-authorized follow-on to immutable Domain commit `0d88591693ee3314033ad0f32d335998b2429f45`. Own this component and `test/chess-model-input/`. The owner subsequently authorized a coherent Domain fix when a physical counterexample proved raw EP affected exact producer features; that separate v1.1 change is commit `8df38d887beae72b156ad69a4b9de77345e8e528`. Do not change frozen producer artifacts, model math, MCGS framework, graph, search/session, UCI or release files.

Files: `device.mjs` supplies restricted Device-JS `mWriteFeatures` and `mPolicyIndex` plus public metadata; `runtime.mjs` is the public CUDA-JS physical qualification capsule; `package.json`/lock pin the public lower package; `contract.md` records exact producer feature/action meaning; `test/chess-model-input/input.test.mjs` compares actual GPU bytes/indices with the immutable producer `candidate-73091/feature-adapter.mjs`.

Hard constraints: JS/Device-JS only; no maintained native/C++/PTX/FFI, CPU active search, host-produced active evaluator features, private lower imports, invented policy map or altered checkpoint/receipt. Inputs are the Domain's complete resident u32 state. Features are caller-owned contiguous FP32 NCHW rows of 1088 elements; all extents/offsets are checked before writes.

Exact producer semantics: 12 canonical piece planes, four full castling-right planes, one EP-target plane. Producer a8=0 versus Domain a1=0; white square xor56, black xor7 plus color swap. Black rights swap low/high two bits. Halfmove/repetition are omitted, not scaled or fabricated. Domain retains these facts. Policy is base canonical-from*64+to plus 22 source-file-major underpromotion edges times N/B/R. Queen stays in base; all 4162 outputs are used, with invalid/absent action represented outside the index range.

EP is the exact raw target at Domain word70, not repetition-effective EP at word66. Compare with original authoritative FEN; normalization must not rewrite the independent oracle input to hide a counterexample.

Sequence: tests fail for missing API; implement explicit metadata/source; independently compare every feature byte, both-color castling/EP orientation and omitted-state invariance; qualify all base from/to indices and all 66 underpromotion slots in both orientations, invalid underpromotion geometry, finite capacity and guard preservation. Run physical Node26.11.1 and preserve new append-only source-bound evidence. Review/commit independently of any later model/graph composition.
