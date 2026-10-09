import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {mkdtempSync,unlinkSync,rmdirSync} from 'node:fs';
import {tmpdir} from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
test('only manual protected-main delivery can sign; portable fixtures never publish',()=>{
 const source=readFileSync('.github/workflows/component-release.yml','utf8');
 assert(source.includes('workflow_dispatch:'));assert(source.includes("github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main'"));assert(!source.includes('pull_request_target'));
 assert(source.includes('persist-credentials: false'));assert(source.includes('id-token: write'));assert(source.includes('cosign-release: v3.0.6'));assert(source.includes('--certificate-github-workflow-sha'));assert(source.includes('--certificate-github-workflow-trigger'));assert(source.includes('--certificate-github-workflow-repository'));assert(source.includes('--certificate-identity'));assert(source.includes('--certificate-oidc-issuer'));
 assert(source.includes('verify-statement'));assert(source.includes('inspect-intake'));assert(source.includes('--qualification-sha256'));assert(source.includes('--archive-sha256'));
 assert(source.includes('--draft'));assert(source.includes('--prerelease'));assert(source.includes('gh release download'));assert(source.includes('gh release create'));assert(!source.includes('gh release edit'));assert(!source.includes('npm install'));assert(!source.includes('npm ci'));assert(!source.includes('self-hosted'));assert(!source.includes('download-artifact@'));
 assert(source.includes('test/release-stage.test.mjs'));assert(source.includes('test/component-package.test.mjs'));assert(!source.includes('inputs.')||!/^\s+run:.*\$\{\{\s*inputs\./mu.test(source),'dispatch input must enter typed argv through environment, never interpolated shell source');
});

test('draft intake routes through the authenticated CLI and a same-owner numeric release ID',()=>{
 const source=readFileSync('.github/workflows/component-release.yml','utf8'),start=source.indexOf('          $draftJson = gh release view $tag'),end=source.indexOf('          node tools/release-stage.mjs inspect-intake',start);
 assert(start>=0&&end>start,'Draft tags cannot use the published-release tag endpoint');
 const block=source.slice(start,end).split('\n').map(line=>line.slice(10)).join('\n'),tag='qualification/vector/v0.1.0/'+'1'.repeat(40),base={apiUrl:'https://api.github.com/repos/iteathen/UCI-Arena-Vector/releases/123',isDraft:true,tagName:tag,targetCommitish:'1'.repeat(40)};
 for(const change of [null,{isDraft:false},{tagName:'other'},{targetCommitish:'main'},{apiUrl:'https://api.github.com/repos/other/repo/releases/123'},{apiUrl:'https://api.github.com/repos/iteathen/UCI-Arena-Vector/releases/0'}]){
  const directory=mkdtempSync(path.join(tmpdir(),'vector-draft-routing-')),quote=value=>"'"+value.replaceAll("'","''")+"'",draft={...base,...change};
  const script=`$ErrorActionPreference='Stop'\n$taskRoot=${quote(directory)}\n$tag=${quote(tag)}\n$env:GITHUB_REPOSITORY='iteathen/UCI-Arena-Vector'\n$env:GITHUB_SHA=${quote('1'.repeat(40))}\n$global:LASTEXITCODE=0\nfunction gh { if ($args[0] -eq 'release') { ${quote(JSON.stringify(draft))} } elseif ($args[0] -eq 'api') { [Console]::Error.WriteLine('API:'+ $args[1]); '{}' } else { throw 'Unexpected command' } }\n${block}`;
  try{const result=spawnSync('pwsh',['-NoProfile','-NonInteractive','-Command',script],{encoding:'utf8',timeout:15000,windowsHide:true});assert.equal(result.error,undefined);if(change){assert.notEqual(result.status,0);assert(!result.stderr.includes('API:'));}else{assert.equal(result.status,0,result.stderr);assert(result.stderr.includes('API:repos/iteathen/UCI-Arena-Vector/releases/123'));assert.equal(readFileSync(path.join(directory,'intake.json'),'utf8').trim(),'{}');}}
  finally{try{unlinkSync(path.join(directory,'intake.json'));}catch(error){if(error.code!=='ENOENT')throw error;}rmdirSync(directory);}
 }
});
