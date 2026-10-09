import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {admitPosition} from '../../components/chess-domain/admission.mjs';
const require=createRequire(new URL('../../components/chess-domain/package.json',import.meta.url)),{Chess}=require('chess.js');
function repetition(cycles){const chess=new Chess(),history=[chess.fen()];for(let i=0;i<cycles;i++)for(const move of ['Nf3','Nf6','Ng1','Ng8']){chess.move(move);history.push(chess.fen());}return admitPosition(chess.fen(),{history});}
const cases=[
  {name:'initial',state:admitPosition(new Chess().fen()),terminal:0,outcome:[0,0,0]},
  {name:'fifty claim remains live',state:admitPosition('4k3/8/8/8/8/8/8/R3K3 w - - 100 60'),terminal:0,outcome:[0,0,1]},
  {name:'threefold claim remains live',state:repetition(2),terminal:0,outcome:[0,0,2]},
  {name:'automatic seventyfive',state:admitPosition('4k3/8/8/8/8/8/8/R3K3 w - - 150 80'),terminal:1,outcome:[3,0,1]},
  {name:'automatic fivefold',state:repetition(4),terminal:1,outcome:[4,0,2]},
  {name:'mate precedes automatic clock draw',state:admitPosition('7k/6Q1/6K1/8/8/8/8/8 b - - 150 80'),terminal:1,outcome:[1,1,1]},
  {name:'stalemate',state:admitPosition('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'),terminal:1,outcome:[2,1,0]},
  {name:'insufficient material',state:admitPosition('7k/8/6K1/8/8/8/8/8 w - - 0 1'),terminal:1,outcome:[5,0,0]},
];
test('physical live draw profile distinguishes claims from actual terminal authority',{skip:process.env.VECTOR_ENGINE_DOMAIN_NATIVE!=='1'},async()=>{let qualify;try{({qualifyLiveDomain:qualify}=await import('../../components/engine-runtime/domain-qualification.mjs'));}catch(e){if(e.code==='ERR_MODULE_NOT_FOUND')assert.fail('Live Domain qualification is missing');throw e;}const r=await qualify(cases.map(c=>c.state.words));for(let i=0;i<cases.length;i++){assert.equal(r.rows[i].terminal,cases[i].terminal,cases[i].name);assert.deepEqual(r.rows[i].outcome,cases[i].outcome,cases[i].name);assert.equal(r.rows[i].guardsPassed,true,cases[i].name);}assert.equal(r.terminal.graceful,true);assert.equal(r.terminal.driver.resourceCounts.live,0);assert.equal(r.terminal.driver.resourceCounts.orphaned,0);});
