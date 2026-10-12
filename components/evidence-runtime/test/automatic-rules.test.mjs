import assert from 'node:assert/strict';
import test from 'node:test';
import {createReferee} from '../referee.mjs';
import {playClockExperimentGame} from '../clock-experiment.mjs';
const auto='lichess-bot-automatic-threefold-v1',orthodox='orthodoxy-live-claims-v1',cycle=['g1f3','g8f6','f3g1','f6g8'];
test('independent bot referee ends third repetition while generic claims remain optional',()=>{const a=createReferee(undefined,{rulesProfile:auto}),b=createReferee(undefined,{rulesProfile:orthodox});for(const m of [...cycle,...cycle]){a.play(m);b.play(m);}assert.equal(a.terminal().termination,'threefold_repetition');assert.equal(b.terminal(),null);assert.throws(()=>a.play('g1f3'),/terminal/);});
test('automatic threefold does not make fifty optional rights terminal and still prioritizes mate',()=>{assert.equal(createReferee('4k3/8/8/8/8/8/8/R3K3 w - - 100 60',{rulesProfile:auto}).terminal(),null);assert.equal(createReferee('7k/6Q1/6K1/8/8/8/8/8 b - - 150 80',{rulesProfile:auto}).terminal().termination,'checkmate');});
test('explicit immutable automatic context reaches actual game referee and record; omitted context stays orthodox',async()=>{
 const config={opening:{id:'history',moves:[...cycle,...cycle.slice(0,3)]},candidateColor:'black',initialTimeMs:180000,incrementMs:0,maxPlies:1,responseTimeoutMs:100,maxDurationMs:1000,referenceGo:{movetime:10},rulesProfile:auto};let moves=0;const session={async position(){},async go(){moves++;return {move:'f6g8',elapsed_ms:1};}};const r=await playClockExperimentGame(config,session,session);assert.equal(moves,1);assert.equal(r.rules_profile,auto);assert.equal(r.trial_controls.rulesProfile,auto);assert.equal(r.termination,'threefold_repetition');assert.equal(r.complete,true);assert.equal(r.qualification.timing,false);
 const old={...config};delete old.rulesProfile;const generic=await playClockExperimentGame(old,session,session);assert.equal(generic.rules_profile,orthodox);assert.equal(generic.complete,false);assert.equal(generic.termination,'max_plies');
});
