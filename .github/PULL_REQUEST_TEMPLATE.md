## Owning issue

Closes #

## Change

Describe the outcome and the authoritative owner of each changed contract, fact, state, or lifecycle.

## LEGO boundary

- [ ] Internal names and types remain true if the current neighbor is replaced or removed.
- [ ] No private sibling-repository implementation is imported.
- [ ] No new native source, direct CUDA FFI, Python, or host-produced active-search intermediate is introduced.
- [ ] The change does not move product meaning into a generic CUDA/MCGS/Tensor library.

## Evidence

List checks run, exact revisions/environments where relevant, and the cheapest decisive falsifier.

- [ ] `node tools/verify-repository.mjs`
- [ ] `git diff --check`
- [ ] New behavior has focused validation or this documentation-only change explains why none is needed.

## Risk and lifecycle

Describe important bounds, failure/cancellation/cleanup behavior, compatibility effects, and any checks not run.

## Contributor certification

- [ ] Commits include a Developer Certificate of Origin `Signed-off-by` line.
- [ ] The change contains no credentials, private artifacts, generated binaries, or machine-specific output.
