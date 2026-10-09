# Installed optional Book binding

Status: scope independently reviewed; version 0.1.2 source candidate, native release qualification pending.

This change owns the optional `opening_book` locator in the atomic component,
Installer renderer and Vector root-knowledge admission. Search, model, Tensor,
MCGS, backend, timing policy and historical native receipts are unchanged.

## Public installation projection

The component declares an optional `opening_book` locator of the existing
Installer kind, accepting `saved_locator` and `install_receipt` sources. It adds
no required component dependency. The renderer consumes the public
`arena_provider_install_context_v1` locator path and typed detail fields
`kind`, `path`, `source`, `storage_mode`, `authority_mode`. Installer already
provides both directory and `.bin`/`.book` file imports and defaults legacy
Book references to `immutable_pinned_snapshot` in that public context.

No selection sets `OwnBook=false`, clears `BookSnapshotBinding` and declares
`knowledge.opening_book` degraded. A missing or incompatible optional selection
also remains degraded. Malformed locator authority rejects rendering. Neither
case enables an unrelated ProgramData or environment-derived Book.

A v2 directory uses the producer's exact `strong_rare_v1.bin`,
`strong_rare_v1.stats`, `strong_rare_v1.policy`, `snapshot.manifest.json` roles.
A regular file import selects only base Polyglot capability: empty statistics,
policy and manifest roles suppress neighboring file discovery. Unsupported
`.book` contents do not acquire v2 semantics merely because Installer accepts
that extension. The full runtime reader still validates all selected bytes.

The generated workspace document `opening-book-binding.json` is supplied by
startup UCI option `BookSnapshotBinding`. `BookFile`, `BookStatsFile` and
`BookPolicyFile` must equal its explicit roles. The document is bounded to
65,536 UTF-8 bytes, rejects unknown/accessor/symbol fields and linked paths, and
has this closed shape:

```text
schema: vector_opening_book_binding_v1
schemaVersion: 1
authorityMode: immutable_pinned_snapshot | service_managed_live_channel
capability: snapshot_v2 | polyglot_base
selection: {path, kind: opening_book, source, storageMode}
files: {bookFile, statsFile, policyFile, manifestFile}
pin: {manifestSha256} | {bookSha256} | null
```

## Runtime authority

Immutable v2 selection captures the exact manifest SHA-256 during rendering;
base selection captures the exact file SHA-256. Admission checks that pin before
activation. After successful admission the engine retains that generation even
if the source path changes. Explicit between-game startup binding configuration
may select another pin. The engine never silently updates an immutable pin.

Live authority requires an in-place v2 directory and no immutable pin. Reload
occurs at between-game readiness (or first pre-game admission), never during an
active game. A failed reload reports the existing reader's explicit retained
complete snapshot disposition, when available. Every game keeps its admitted
immutable in-memory generation. Bound file/binding changes are rejected during
a game. A `go` cannot remove the binding to acquire defaults; disabling and
re-enabling `OwnBook` only gates the existing game snapshot. A game beginning
with Book disabled cannot acquire a new generation halfway through that game.
Existing standalone unbound next-go file reconfiguration remains supported.

The renderer labels configured data `configured-pending-engine-admission`,
never qualified. Runtime status reports actual admission, retention or degraded
failure. Legal action/focus fences, statistical policy, RNG and exit latch stay
with the existing Book reader/game owner.

## Verification and scope

Meaningful failure tests reproduced ignored immutable pins, unauthorized
active-game default reload, toggle rejection, corrupted selection authority,
and executable/coercible metadata. Real portable Book-reader tests distinguish
live between-game refresh from immutable generation preservation. Renderer
fixtures cover personal directory and file imports, unavailable optional data
and exact package locator projection. They cannot publish qualification files.

No GPU campaign, installed mutation, model change or signed payload rewrite was
performed. The packaging owner exports `VECTOR_COMPONENT_VERSION=0.1.2` and uses it for new
component builds when no explicit version is supplied. Manifest, runtime closure,
launch profile and optional Evidence contract retain the same exact version.
Explicit historical versions remain verifiable. Fresh native/relocated/signing
gates are pending; signed 0.1.1 evidence remains historical.

For the separately owned native interop probe, set `VECTOR_UCI_BOOK_ROOT` to
an explicitly unqualified fixture snapshot and `VECTOR_UCI_BOOK_BINDING` to its
actual renderer-produced binding document. `NativeUci.ready` requires the engine
to advertise `BookSnapshotBinding`, then sends that option before `isready` with
normalized explicit Book role paths. Portable transport tests exercise this
helper without spawning an engine. Native receipts retain `includes_fixture`
and `qualified=false`; they cannot establish a qualified Book population.
