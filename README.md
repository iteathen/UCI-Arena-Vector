# UCI Arena Vector

UCI Arena Vector is a GPU-resident chess engine with a standard UCI interface
for chess GUIs and the UCI Arena suite. Runnable provisional Windows candidates
compose persistent cuda-js/MCGS search with the original LatticeKnight model.
Actual candidate evidence covers legal moves, complete diagnostic games,
retained graph work, root knowledge and joined GPU teardown on the measured
hardware/runtime tuple. It does not establish playing strength or population
latency guarantees.

The current source targets install component **0.1.2**, adding optional selected
Book binding with enforced live-channel and immutable-snapshot authority.
Its fresh native, relocated-payload and signing qualification is pending.
Historical signed 0.1.1 payloads and receipts retain their original scope.
Complete-suite transactional installation and installed Bot acceptance remain
in progress; this is not a stable general release.

Vector owns chess rules, UCI lifecycle, model feature/action meaning, concrete
search policy and product knowledge. Generic search, tensor mathematics and CUDA
execution remain with the public CUDA-MCGS, CUDA-JS-Tensor and CUDA-JS libraries.
Maintained production source is JavaScript and restricted Device-JS through
those contracts, with device-owned search progress and bounded public control
and observation. There is no maintained C++ engine or CPU search fallback.
See [current status](STATUS.md) and the
[connector map](docs/architecture/CONNECTOR_MAP.md).

## Candidate packaging and verification

[The atomic component packager](tools/component-package.mjs) emits one complete
`uci_arena.vector` runtime payload, including its model, public library closure,
launch profile and exact runtime qualification receipt. It retains all native
qualification, inventory, source and license gates. The
[release workflow](.github/workflows/component-release.yml) verifies and signs
only an unchanged qualified archive into a draft provider candidate. Installer
consumes signed, verified component rows through its public composition route;
no source checkout or partial payload is an installed-engine substitute.

[The selected Book binding contract](components/root-knowledge/contract.md)
describes the new optional installed selection. Missing/incompatible optional
knowledge is explicitly degraded. Unconfigured useful-block timing authority
purchases no discretionary search time and publishes the available current
completed move; measured clock safety remains separately qualified.

Contributors can run portable checks with the admitted public dependencies and
Node 26.11.1:

```bash
node --experimental-ffi --test "**/*.test.mjs"
node tools/verify-repository.mjs
```

Native tests are explicit opt-in gates against the exact source/runtime/model
and hardware tuple; portable test skips do not qualify a release.

- [Complete suite plan](docs/superpowers/plans/2026-10-08-complete-cuda-js-suite.md).
- [Book binding source candidate](docs/development/2026-10-09-installed-book-binding.md).
- [Accepted chess search boundary](docs/specs/VECTOR-0002-native-boundary-and-js-only-implementation.md).
- [Contributing](CONTRIBUTING.md), [developer instructions](AGENTS.md),
  [support](SUPPORT.md), [security reporting](SECURITY.md), and [GNU GPL v3 license](LICENSE).
