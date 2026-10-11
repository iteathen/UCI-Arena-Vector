import assert from 'node:assert/strict';
import test from 'node:test';
import {admitClockOptionBindings} from '../tools/clock-option-bindings.mjs';
const candidate=()=>({schema:'arena_uci_clock_option_bindings_v1',schema_version:1,bindings:{TimingInitialTimeMs:'initial_ms'}});
const options={TimingInitialTimeMs:0,FixtureIncrement:0};
const advertised=[{name:'TimingInitialTimeMs',type:'spin',min:0,max:3600000},{name:'FixtureIncrement',type:'spin',min:0,max:60000}];
test('optional clock declaration retains immutable zero baseline and only declares original clock fields',()=>{
 assert.equal(admitClockOptionBindings(undefined,{}),undefined);
 const value=candidate(),copy=structuredClone(value),accepted=admitClockOptionBindings(value,options,advertised);
 assert.deepEqual(accepted,copy);assert.deepEqual(value,copy);assert.equal(options.TimingInitialTimeMs,0);assert(Object.isFrozen(accepted.bindings));
 value.bindings.FixtureIncrement='increment_ms';assert.equal(admitClockOptionBindings(value,options,advertised).bindings.FixtureIncrement,'increment_ms');
});
test('clock declaration rejects unknown schema fields, source units, cardinality and missing baseline',()=>{
 for(const value of [null,[],{...candidate(),extra:true},{...candidate(),schema:'unknown'},{...candidate(),schema_version:'1'},
  {...candidate(),bindings:{}},{...candidate(),bindings:{TimingInitialTimeMs:'remaining_ms'}},
  {...candidate(),bindings:{TimingInitialTimeMs:'initial_ms',FixtureIncrement:'increment_ms',Third:'initial_ms'}},
  {...candidate(),bindings:{Missing:'initial_ms'}},{...candidate(),bindings:{'bad\nname':'initial_ms'}}])assert.throws(()=>admitClockOptionBindings(value,options,advertised));
 assert.throws(()=>admitClockOptionBindings(candidate(),{TimingInitialTimeMs:'0'},advertised));
});
test('advertised clock options must be unambiguous spin fields whose bounds admit baseline',()=>{
 for(const list of [[],[advertised[0],advertised[0]],[{...advertised[0],type:'string'}],[{...advertised[0],min:1}],
  [{...advertised[0],min:NaN}],[{...advertised[0],min:10,max:0}]])assert.throws(()=>admitClockOptionBindings(candidate(),options,list));
});
