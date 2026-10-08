# LatticeKnight Device model input v1

This product component translates a validated resident chess Domain state into the frozen producer's model-visible features and action projection. It owns no model mathematics, neural runtime, evaluator scheduling, graph, policy selection, backup or UCI publication. Maintained source is ordinary JS plus restricted Device-JS, compiled/executed solely through public CUDA-JS.

Producer authority is the immutable 73091 successor candidate's `feature-adapter.mjs`, SHA-256 `b217a6586d73854acd4a1d2e641c4bb7b879942eaa061219895afedc638e5632`. Its `io_contract` and feature capability contract match frozen 54499. Independent qualification imports that exact file only after verifying its digest. No producer artifact, model weights, ONNX graph or numerical receipt is changed.

## Callable contribution

`buildModelInputDeviceModule()` returns restricted source and explicit function metadata, with these device functions:

```text
mSquare(square:u32, side:u32) -> u32
mWriteFeatures(state:ptr<u32>, base:u32, stateCapacity:u32,
               features:ptr<f32>, featureBase:u32, featureCapacity:u32) -> u32
mPolicyIndex(state:ptr<u32>, base:u32, stateCapacity:u32, action:u32) -> i32
```

Capacities and bases are element counts/offsets relative to their supplied typed contiguous capabilities, not bytes or raw pointers. The caller must supply actual backing extents and a validated `vector.chess-mailbox-u32/1.1.0` state, 17,223 u32 words (68,892 bytes). Domain header offsets remain piece mailbox0..63, side64, rights65, effectiveEP66, halfmove67, fullmove68, history-count69, rawEP70; history starts71. Feature generation reads rawEP70. It never substitutes effectiveEP66 or discards EP because capture is illegal.

`mWriteFeatures` first rejects insufficient state/feature extent with status1, then invalid piece/side/rights/rawEP encoding with status2. It performs no output writes on failure. Status0 writes exactly1088 f32 elements beginning at featureBase, using only exact0.0/1.0 values. Output may be a selected item partition of the Graph/Evaluator-owned input buffer. Writer is read-only with respect to state and owns no retained mutable host state.

Input/state/output/scratch lifecycle, Domain root validity, action legality, semantic incarnation and evaluator request identity remain with their respective owners. Passing model projection does not validate a chess move. `mPolicyIndex` checks backing extent, side and packed metadata/underpromotion geometry; callers must separately admit actions through the Domain against the exact origin state/profile before consuming a policy logit.

## Exact feature layout

Output is FP32 contiguous NCHW `[N,17,8,8]`; one item uses1088 elements/4352 bytes. Piece planes0..11 are canonical `P,N,B,R,Q,K,p,n,b,r,q,k`. Planes12..15 contain full-plane canonical K/Q/k/q rights. Plane16 contains one-hot rawEP, or all zeros when absent.

Domain square numbering is a1=0; producer numbering is a8=0. White-to-move canonical square is `domainSquare xor56`. Black-to-move canonical square is `domainSquare xor7`; piece colors swap and rights low/high two bits swap. Black rights preserve K-versus-Q labels exactly as the producer declares, even though board rotation changes files. EP follows the same square transform.

Halfmove, fullmove and repetition produce no feature/scaling plane. Their absence is model visibility, not absence of Domain state. Different rule/history states can share feature bytes while retaining distinct state/cache authority. RawEP can affect feature bytes even when it has no legal/repetition effect; therefore Domain v1.1 separately retains it in full state identity/equality.

## Exact4162 action projection

Input action is the Domain packed u32: from bits0..5, to6..11, promotion12..14 (`0=none,1=N,2=B,3=R,4=Q`). Convert from/to into canonical producer square numbering with the side transform above.

- None and queen promotion: `canonicalFrom *64 +canonicalTo`, covering mathematical base region0..4095.
- N/B/R: canonical source rank7 (`from/8=1` in producer numbering), target rank8 (`to/8=0`), file delta at most1. Enumerate source files a..h, and each source's valid target files left-to-right. The22 edges occupy source-file-major slots0..21. Index is `4096 +slot*3 +(promotion-1)`.
- Mapping table identity: `from_to_4096_plus_underpromotion_source_file_major_v1`, SHA-256 `8323f353a31bc61b2aee8ed1cdbc05e5062f6c096c9c54d1cfc1ad7b72d5905b`.
- All66 extension outputs4096..4161 are used. There is no reserved output tail. Invalid/absent/high-bit/out-of-range-promotion/invalid-underpromotion geometry returns i32-1, which must never index the policy output.

Base projection intentionally includes mathematical from/to pairs that are illegal in a given board, including self-pairs; Domain validation/masking owns that distinction. Projection never promotes a dense logit into move authority.

## Qualification and reproduction

The standalone capsule composes public product Domain Device-JS with this module through public CUDA-JS. It normalizes the exclusively owned input state on-device before feature writing, proving that rawEP survives actual repetition normalization. It runs one independent input item per thread, with fixed4096 mapping slots/item and an explicit1..32 row bound. Inputs/features/mapping/status ranges are checked; feature buffers carry sentinel guards. There is one device operation and only terminal reads/teardown.

Install with `npm ci --ignore-scripts --no-audit --no-fund --prefix components/chess-model-input`. Run `node --test test/chess-model-input/input.test.mjs` for public frontend admission. Set `VECTOR_CHESS_NATIVE=1` for physical checks and run `node --experimental-ffi --test test/chess-model-input/input.test.mjs`. The independent adapter defaults to the task's immutable `candidate-73091/feature-adapter.mjs`; `VECTOR_FEATURE_ORACLE` may select a copy only with the identical pinned digest. `VECTOR_MODEL_INPUT_RECEIPT` names a new append-only JSON receipt; existing paths reject overwriting.

Evidence covers11 baseline/orientation/EP/promotion/omitted-state feature cases, two original rawEP counterexamples, 8192 base projections, 176 promotion projections (all66 underpromotion outputs in both orientations plus queens), invalid metadata, pre-write encoding/capacity rejection and guard/cleanup truth. Exact native profile only; this does not qualify NN numerical parity, device graph/search/session, UCI, strength or release behavior.
