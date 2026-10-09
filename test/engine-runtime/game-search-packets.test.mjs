import assert from 'node:assert/strict';
import test from 'node:test';
import {encodeSessionPacket,decodeSessionReply,assertTerminalQuiescence,createIgnitionResources,resolveExecutionPorts} from '../../components/engine-runtime/game-search-packets.mjs';
const command={phase:0,result:1,kind:2,expectedArena:3,expectedFocusEpoch:4,expectedRootSlot:5,expectedRootGeneration:6,idBase:8,generationBase:12,responseRootSlot:16,responseRootGeneration:17,responseFocusEpoch:18,stateWords:20,admissionActionCount:21,actionWords:22,stateBase:32,kinds:{admit:1,cancel:3},phases:{uploading:1,pending:2,acknowledged:3},results:{accepted:0,pressure:2}};
const core={layout:{stateWords:3,actionWords:1,maxAdmissionActions:2},protocol:{command,packetWords:37,terminal:{identityWords:4,fields:{acceptedCommandIdBase:24,acceptedCommandGenerationBase:28},quiescence:{zeroFields:[12,13,14,15,16,21,22],equalPairs:[[17,18],[19,20]]}}}};
test('session replay packet preserves external state/actions and complete command identity',()=>{
 const bytes=encodeSessionPacket(core,{kind:1,authority:{arena:9,root:7,generation:6,epoch:5},id:[1,2,3,4],generation:[5,6,7,8],state:new Uint32Array([11,12,13]),actions:[41,42]});
 const words=new Uint32Array(bytes.buffer);assert.equal(words.length,37);assert.deepEqual([...words.slice(8,16)],[1,2,3,4,5,6,7,8]);assert.deepEqual([...words.slice(32)],[11,12,13,41,42]);assert.equal(words[21],2);
 assert.throws(()=>encodeSessionPacket(core,{kind:1,id:[0,0,0,0],generation:[1,0,0,0],state:new Uint32Array(3),actions:[]}),/identity/);
 assert.throws(()=>encodeSessionPacket(core,{kind:1,id:[1,0,0,0],generation:[1,0,0,0],state:new Uint32Array(3),actions:[1,2,3]}),/extent/);
});
test('ack rejects stale command identity and retains explicit pending/pressure dispositions',()=>{
 const expected={id:[1,0,0,0],generation:[2,0,0,0]},words=new Uint32Array(32);words[0]=3;words[1]=0;words[8]=1;words[12]=2;words[16]=4;words[17]=5;words[18]=6;
 assert.deepEqual(decodeSessionReply(core,new Uint8Array(words.buffer),expected).authority,{root:4,generation:5,epoch:6});words[12]=3;assert.throws(()=>decodeSessionReply(core,new Uint8Array(words.buffer),expected),/identity/);words[0]=2;assert.equal(decodeSessionReply(core,new Uint8Array(words.buffer),expected).pending,true);
});
test('terminal facts require joined semantic leases and exact accepted cancel identity',()=>{
 const words=new Uint32Array(32),cancel={id:[9,0,0,0],generation:[8,0,0,0]};words[24]=9;words[28]=8;words[17]=words[18]=4;words[19]=words[20]=2;
 assertTerminalQuiescence(core,new Uint8Array(words.buffer),cancel);words[21]=1;assert.throws(()=>assertTerminalQuiescence(core,new Uint8Array(words.buffer),cancel),/quiescence/);words[21]=0;words[18]=3;assert.throws(()=>assertTerminalQuiescence(core,new Uint8Array(words.buffer),cancel),/lease/);words[18]=4;words[24]=7;assert.throws(()=>assertTerminalQuiescence(core,new Uint8Array(words.buffer),cancel),/identity/);
});
test('cold bytes use canonical realization IDs/views rather than semantic Resource identities',()=>{
 const c={resourceRequirements:[{id:'resource-9',byteLength:'24'}],operationRequirements:[{bindings:[{parameter:'initialRootInput',source:{kind:'resource',resource:'resource-9',view:{dtype:'u32',byteOffset:'0',elementCount:'2'}}},{parameter:'input1',source:{kind:'resource',resource:'resource-9',initialContentSha256:'a',view:{dtype:'f32',byteOffset:'16',elementCount:'1'}}}]}],deliveryRequirements:[]};
 const bytes=createIgnitionResources(c,new Uint8Array([1,2,3,4,5,6,7,8]),{input1:{bytes:new Uint8Array([9,10,11,12]),sha256:'a'}});assert.deepEqual(Object.keys(bytes),['resource-9']);assert.deepEqual([...bytes['resource-9']],[1,2,3,4,5,6,7,8,0,0,0,0,0,0,0,0,9,10,11,12,0,0,0,0]);assert.throws(()=>createIgnitionResources(c,new Uint8Array(8),{input1:{bytes:new Uint8Array(4),sha256:'b'}}),/identity/);
});
test('public realization ports match declared callable identity and package-delivery reference',()=>{
 const semantic={operationIds:{bootstrap:'owner.boot',command:'owner.cmd'},operations:[{id:'owner.boot',entryPoint:'actualBootstrap'},{id:'owner.cmd',entryPoint:'actualCommand'}],delivery:{id:'owner.terminal'}},physical={operationRequirements:[{id:'operation-4',function:'actualCommand'},{id:'operation-3',function:'actualBootstrap'}],deliveryRequirements:[{id:'delivery-0',packageDelivery:'owner.terminal'}]};
 assert.deepEqual(resolveExecutionPorts(semantic,physical),{operationIds:{bootstrap:'operation-3',command:'operation-4'},deliveryId:'delivery-0'});assert.throws(()=>resolveExecutionPorts(semantic,{...physical,operationRequirements:[...physical.operationRequirements,{id:'operation-5',function:'actualCommand'}]}),/unique/);
});
