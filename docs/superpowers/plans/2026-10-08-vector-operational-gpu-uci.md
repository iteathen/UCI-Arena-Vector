# Vector operational GPU UCI implementation plan

Owner authorizes inline implementation and product choices under complete-suite task 6, with root independent review. Worktree `vector-gpu-engine-runtime-20261008` starts at de6952f. Owned files are new chess-policy, engine-runtime, uci-protocol components, dist/uci.mjs and their tests/contracts. Qualified Tensor9/model834d and frozen fixtures remain immutable.

1. Test UCI parser and asynchronous controller before implementation: malformed moves/FEN/go limits, stale publications, duplicate stop, replacement while work is pending, clocks firing independently of GPU wait, terminal null move and graceful close. Injected port is protocol-only evidence.
2. Define exact chess Policy source/profile facts and independent PUCT/prior/perspective/mate fixtures. Bind public normalized Domain/Graph/Policy/Resource/Progress/Output profiles and canonical MCGS source contributions; route missing generic participation/lifecycle capability to its owner.
3. Compose GPU admission, features, typed Tensor library, core and bounded publication through public packages. Retain original model mathematics, exact artifact identities and block32 participation. Fail before ignition on cohort/resource mismatch.
4. Implement public GameSearchPort and operational dist/uci.mjs. Search continuation has one initial host launch, GPU-owned progress and no host relaunch. Admission/publication control is external intent. Timing cannot mutate search work/attention.
5. Run exact Node26.11.1 public native chess search, pending-work clock tests and complete legal games; retain source/package/model/device identities, observations and graceful cleanup. Root reviews before packaging/installer/bot integration.

Review focus: no stale root move; no terminal `0000` without proof; no deadline blocked by GPU wait; no clock-goals used as search budgets; legal publication during pending evaluation; opponent mate proof dominates NN/prior/statistics; failed admission cannot grant root authority; finite resource pressure cannot fabricate successful search.

## Foundation execution record

Nine protocol tests pass, including pending admission/stop intent, stale authority, monotonic epochs across game boundaries and independent publication timers. Two external-authority packet tests pass; the twelve-word packet preserves raw EP and clocks without host transition/feature generation. These are layer unit tests only.

Exact Node26.11.1/CUDA-JS alpha21 native Policy primitives passed independent literal softmax/selection/backup/proof cases. The first malformed-proof case failed because an early winning proof hid a later invalid record; all records now validate before proof commitment, and the same physical case passes. Receipt `E:/uci-arena-task-builds/vector-model-parity-evidence-20261008/policy-primitives-qualified-observation.json` SHA256 `349c52a9cb6d2be8ae451e7f1cace9acb1e92e470a669a9a51cf570da9580d82` retains exact source/artifact/runtime and graceful zero-live cleanup.

Publication row encoder/comparator primitives passed actual GPU checks for proof dominance, read-only comparison, malformed-row rejection and encode-failure no-write. Receipt `publication-row-primitives-qualified-observation.json` in the same evidence root SHA256 `883f210d3e9ee213f538d92e1bc36bf902c2b47880a0fd8fc7baa58c757011d0`. Core owns immutable snapshot lifetime; a preliminary standalone seqlock draft was discarded before native qualification after accepted SPEC-0013 borrow semantics were checked.

Current full portable repository command `node --test 'tools/*.test.mjs' 'test/**/*.test.mjs'`: 84 tests, 74 pass, 10 explicitly hardware-skipped, zero fail, preserving frozen Tensor6 context dependencies in tools and current Policy CUDA21 dependency capsule independently. Repository policy passes. These foundations do not constitute operational gpu-search, legal-game, clock-safety or whole-runtime acceptance. Generic cooperative/persistent core ABI and final public cohort are being finalized by their owners before actual engine composition.
