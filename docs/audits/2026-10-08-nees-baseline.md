# NEES baseline and optimization scope

Status: baseline audit in progress; no whole-engine NEES conformance or
performance promotion claim. Correctness, actual resident search, installation
and live clock qualification remain required independently.

The owner requested the NEES baseline used by Connect4. Its declared authority
is `iteathen/NEES@3a78310a3ba14fb3acb4046c8dffd396209c213c`, Draft 0.3,
as recorded in Connect4's `ISOMAX_HOT_LOOP_NEES_REALIZATION_AUTHORITY_0_2.md`.
The core specification, methods M01–M46, conformance, agent usage, stale-advice
firewall and Node 26 profile govern the candidate audit. They do not import
Connect4 gameplay, solver semantics, proof values or performance results.

The actual managed runtime is Node `26.11.1`, V8 `14.6.202.34-node.37`,
`win32/x64`, matching the `node26-v8-14.6` reference family. Realization-sensitive
claims must retain this exact tuple and their hardware/driver/workload scope.

## Semantic authority and execution classes

Vector's accepted native-boundary specification and the owner's explicit
cuda-js proof requirement take precedence. Active Domain transitions, features,
neural evaluation, Graph, Progress and Policy execute on the GPU through public
cuda-js/MCGS/Tensor contracts. No C++ engine, CPU search/evaluator, handwritten
PTX, private binder or host search relaunch is an admissible optimization.

| Scope | Class | Owning boundary | Current audit disposition |
| --- | --- | --- | --- |
| Domain transitions, exact equality and relevant history | Device E1 | Vector Domain and public MCGS ports | Exact semantics required; full-capacity copying and unused storage traffic require measurement and owner proof before narrowing. |
| Graph lookup, realization, bounded pressure and Policy backup | Device E0/E1 | MCGS Graph/Progress plus Vector Policy | Finite prepared storage and generations required; collision equality, protected paths and one-candidate second chance cannot be weakened. Complete cost audit pending frozen source. |
| Neural feature encoding and model execution | Device E0/E1 | Vector semantics and public Tensor Evaluator | Original model mathematics and parity required; collective geometry, occupancy, memory traffic and batch utilization remain performance questions. |
| Safe-point capture, immutable borrowing and publication | Device E2; host E2/E3 | MCGS Output/Session and Vector move decision | Coherent visits/sum, current focus fence, borrow lifetime and independent observation required. Actual observation during the full NN body remains a qualification gate. |
| UCI command admission and publication timers | Host E3, repeated polling E2 where used | Vector protocol/GameSearchPort | Bound input, queue, copies and timers; preserve elapsed clock and cancellation. No polling assumption is a timing proof. |
| Source/model/schema validation, compilation and typed linking | COLD | Each public producer and runtime adapter | Required once before active execution; no per-node or per-publication artifact hashing/compilation. |
| Package inventory, provenance and installer rendering | COLD | Vector provider and generic Installer | Whole output folder is the payload; automatic inventory is integrity data, not per-file installer lifecycle logic. |
| Evidence subprocess retirement | E3/COLD | Vector Evidence runtime | Actual exit/stdio/forced disposal retained; process exit alone cannot establish joined GPU cleanup. |

V8 object shapes, element kinds and CPU worker-pool tactics do not directly
describe restricted Device-JS's GPU machine realization. Their Node rules apply
to the actual host sites at their observed frequency. Stable NEES identity,
capacity, lifetime, representation and coordination principles remain relevant
across the GPU boundaries. Native-escape methods do not override the design.

## Durable unresolved cost and experiment record

These are active investigation items, not silently accepted costs or completed
optimizations. No entry below is promoted by a portable test or a generic counter.

| Site | Mechanism and admission | Falsifier / required control | Disposition and owner |
| --- | --- | --- | --- |
| One active Evaluator request and collective block32 | Possible underuse of GPU execution and batch capacity. Compare genuinely supported geometries/concurrency under the exact model and declared Resource limits. | Parity, ordering, lifecycle or capacity changes invalidate the comparison; more utilization without lower total cost is not a win. Same-build null/control and held-out positions required. | UNVERIFIED-DEBT; Tensor/MCGS producers. Initial single-worker admission establishes no throughput optimum. |
| Domain state copies, complete equality and TT probes | Measure bytes touched and repeated work, including prepared but unused history capacity. Use stronger admitted state facts only where the owner can prove them. | Different relevant ledger, irreversible-boundary behavior, collisions or retained off-focus meaning must not change. | UNVERIFIED-DEBT; Domain/Graph owners. Immutable graph state is not interchangeable with a local mutable recurse/undo stack. |
| Host publication polling and FFI boundary | Count polls, transfers, allocations, waits and crossing cost at real cadence. Reuse prepared views only with explicit backing/lifetime ownership. | A change that delays current-focus publication, races an immutable borrow, or worsens total latency fails. | UNVERIFIED-DEBT; GameSearchPort and runtime adapter. Public SDK owns native ABI and pointer mechanics. |
| CPU affinity and CPU cache locality | Possible host event-loop/transport latency improvement. Apply only to owned processes with recorded CPU topology and OS controls outside the hot path. | Compare unpinned and same-build null runs; pinning that raises p99/max latency, starvation or total cost is rejected. CPU L2 results cannot be relabelled as GPU L2 evidence. | UNVERIFIED-DEBT; host/runtime qualification. No global process affinity change is authorized by this record. |
| GPU cache/memory locality | Inspect available public producer/device observations, layout and reuse; route missing generic observations to their owner. | No private SDK reads or fabricated cache counters. Unsupported dimensions stay unknown. | UNVERIFIED-DEBT; Tensor/MCGS/cuda-js owners. |
| Diagnostics and artifact checks | Keep rich JSON, hashes, compilation and process snapshots outside Device E0/E1 and successful host hot polling. Inspect actual call sites before claiming removal. | Moving required current-generation validation outside its valid lifetime is incorrect. | Audit pending; respective semantic owners. |

The initial complete E0–E2 audit must inventory calls, branches, loads/stores,
allocation/lifetime, conversions, scans, synchronization, transfers and runtime
machinery. Each cost needs REQUIRED, TRADEOFF, UNAVOIDABLE-PROFILE, COSTED-OUT,
REMOVED, SUPERSEDED, UNVERIFIED-DEBT or explicit DEVIATION disposition. A dominant
NN cost determines priority; it does not erase smaller known costs.

Qualification uses coherent source changes rather than a full benchmark after
each edit. Required invariants and premise failures get targeted development
checks. Promotion still requires meaningful same-build controls, independent
held-out evidence, actual completed search/game and deadline observations,
normal joined retirement, and honest unsupported dimensions. Playing strength,
clock allocation policy, NEES intent and performance are separate claims.
