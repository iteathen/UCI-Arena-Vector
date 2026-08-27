# Security policy

## Supported versions

Vector is in a pre-release specification and connector-planning phase. There is no supported production engine release. Security fixes are applied to the default branch and will be documented here when versioned releases begin.

## Report a vulnerability privately

Do not open a public issue, discussion, or pull request for a suspected vulnerability.

Use GitHub's [private vulnerability reporting form](https://github.com/iteathen/UCI-Arena-Vector/security/advisories/new). Include:

- the affected revision, contract, workflow, or artifact;
- reproduction conditions and expected impact;
- the smallest safe proof of concept;
- known mitigations or related upstream components;
- whether the report is also relevant to a public dependency.

Do not include live credentials, third-party personal data, or destructive payloads. If a dependency owns the defect, report it privately to that owner and identify the boundary here without publicly disclosing exploitable detail.

Maintainers will acknowledge a complete report as capacity permits, validate ownership and severity, coordinate a fix, and agree on disclosure timing with the reporter. Please allow remediation before public disclosure.

## Security boundaries

- Secrets and private runtime artifacts never belong in commits, issues, logs, fixtures, or diagnostics.
- Generated CUDA/PTX/cubin/LTO/native artifacts are opaque library outputs, not Vector source.
- Dependencies enter through public, versioned contracts and exact compatibility identities.
- GitHub Actions must use least-privilege permissions and immutable full-commit action pins.
- Failure, cancellation, pressure, partial validity, and cleanup are security-relevant behavior.

General hardening suggestions without a concrete vulnerability may use the contract/architecture issue form.
