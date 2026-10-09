import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
test('only manual protected-main delivery can sign; portable fixtures never publish',()=>{
 const source=readFileSync('.github/workflows/component-release.yml','utf8');
 assert(source.includes('workflow_dispatch:'));assert(source.includes("github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main'"));assert(!source.includes('pull_request_target'));
 assert(source.includes('persist-credentials: false'));assert(source.includes('id-token: write'));assert(source.includes('cosign-release: v3.0.6'));assert(source.includes('--certificate-github-workflow-sha'));assert(source.includes('--certificate-github-workflow-trigger'));assert(source.includes('--certificate-github-workflow-repository'));assert(source.includes('--certificate-identity'));assert(source.includes('--certificate-oidc-issuer'));
 assert(source.includes('verify-statement'));assert(source.includes('inspect-intake'));assert(source.includes('--qualification-sha256'));assert(source.includes('--archive-sha256'));
 assert(source.includes('--draft'));assert(source.includes('--prerelease'));assert(source.includes('gh release download'));assert(source.includes('gh release create'));assert(!source.includes('gh release edit'));assert(!source.includes('npm install'));assert(!source.includes('npm ci'));assert(!source.includes('self-hosted'));assert(!source.includes('download-artifact@'));
 assert(source.includes('test/release-stage.test.mjs'));assert(source.includes('test/component-package.test.mjs'));assert(!source.includes('inputs.')||!/^\s+run:.*\$\{\{\s*inputs\./mu.test(source),'dispatch input must enter typed argv through environment, never interpolated shell source');
});
