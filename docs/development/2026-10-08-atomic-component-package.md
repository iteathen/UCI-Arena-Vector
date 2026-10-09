# Atomic Vector component package

`tools/component-package.mjs` packages one completed runtime directory as one
deterministic tar.gz payload. It generates the Installer component inventory
from the actual directory; there are no authored per-file installer components
or GUIDs. Installer retains its existing deployment and recovery authority.

The component is `uci_arena.vector`. Its executable entrypoint is the unchanged
official Node 26.11.1 binary at `bin/node.exe`, with the product-owned managed
launch profile passing `--experimental-ffi dist/uci.mjs`. The payload owns its
complete JavaScript, public library, model, license and evidence closure.

Before writing package metadata, the builder verifies the exact declared file
inventory, model parameter digest, public library package versions/commits,
Vector source identity, and an acceptance receipt bound to every runtime file.
The receipt must pass GPU search, legal game, clock safety and lifecycle gates.
The supplied receipt remains evidence input; the builder does not independently
perform those tests or issue provenance. Official release signing remains an
explicit protected workflow responsibility.

The generated component manifest and runtime closure support verification after
extraction. Changed, extra or missing files, mixed versions, unsafe relative
paths, case collisions and symbolic links fail admission. Installer and Bot
consume the published artifact/profile contracts without reading Vector source.

Six package contract tests pass on Node 26.7.0 and 26.11.1. These tests use a
small synthetic payload and establish packaging behavior only. They do not
establish that the actual engine or installed suite is qualified. Actual release
construction remains pending the composed GPU runtime acceptance gates.

An inventoried root-provider selection adds an optional declared `runtime/`
component-path binding and Syzygy locator subscription. The renderer generates
public configuration and binding documents in the mutable provider workspace;
table files remain in their selected directory and must pass provider admission.
The component manifest's `dependencies` contains required string identifiers
only. The optional provider is declared solely through the existing installer
binding with `required: false`; it does not broaden that manifest format or
force the provider into the suite's required dependency set.

A bundled `contracts/timing-policy.json` is admitted against the inventoried
actual runtime identity before its file/digest options enter the managed launch
profile. Initial time defaults to unknown zero. A caller that knows the game's
initial control supplies it explicitly; the package does not infer initial time
from a remaining clock. Packaging fixtures remain interface tests and cannot
authorize signing or activation.
