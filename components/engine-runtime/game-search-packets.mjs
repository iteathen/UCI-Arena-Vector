const u32=(value,label)=>{if(!Number.isInteger(value)||value<0||value>0xffff_fffe)throw new Error(`${label} exceeds finite u32 extent`);return value;};
const identity=(value)=>{if(!Array.isArray(value)||value.length!==4||value.some(v=>!Number.isInteger(v)||v<0||v>0xffff_ffff)||value.every(v=>v===0))throw new Error('Nonzero 128-bit command identity required');return value;};
const wordsOf=bytes=>{if(!(bytes instanceof Uint8Array)||bytes.byteLength%4)throw new Error('Invalid bounded u32 delivery');return new Uint32Array(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));};
export function encodeSessionPacket(core,{kind,authority={},id,generation,state,actions=[],poll=false}){
 const C=core.protocol.command,L=core.layout,w=new Uint32Array(core.protocol.packetWords);identity(id);identity(generation);
 if(!Object.values(C.kinds).includes(kind))throw new Error('Unsupported Session command kind');
 if(!Array.isArray(actions)||actions.length>L.maxAdmissionActions||actions.some(a=>!Number.isInteger(a)||a<0||a>0x7fff))throw new Error('External action replay extent invalid');
 if(state!==undefined&&(!(state instanceof Uint32Array)||state.length!==L.stateWords))throw new Error('External state extent invalid');
 if(kind===C.kinds.admit&&!state)throw new Error('Admission requires complete external state');
 w[C.phase]=poll?C.phases.pending:C.phases.uploading;w[C.kind]=kind;
 for(const [key,index]of [['arena',C.expectedArena],['epoch',C.expectedFocusEpoch],['root',C.expectedRootSlot],['generation',C.expectedRootGeneration]])w[index]=u32(authority[key]??0,key);
 w.set(id,C.idBase);w.set(generation,C.generationBase);w[C.stateWords]=state?.length??0;w[C.admissionActionCount]=actions.length;w[C.actionWords]=L.actionWords;
 if(state)w.set(state,C.stateBase);w.set(actions,C.stateBase+L.stateWords);
 return new Uint8Array(w.buffer);
}
export function decodeSessionReply(core,bytes,expected){
 const C=core.protocol.command,w=wordsOf(bytes);if(w.length!==32)throw new Error('Session response extent invalid');
 if(w[C.phase]!==C.phases.acknowledged)return {pending:true,phase:w[C.phase],disposition:w[C.result]};
 if(!identity(expected.id).every((v,i)=>w[C.idBase+i]===v)||!identity(expected.generation).every((v,i)=>w[C.generationBase+i]===v))throw new Error('Session response command identity mismatch');
 if(w[C.result]!==C.results.accepted)throw new Error(`GPU Session rejected command: ${w[C.result]}`);
 return {pending:false,authority:{root:w[C.responseRootSlot],generation:w[C.responseRootGeneration],epoch:w[C.responseFocusEpoch]}};
}
export function assertTerminalQuiescence(core,bytes,cancel){
 const T=core.protocol.terminal,w=wordsOf(bytes);if(w.length<(T.headerWords??32))throw new Error('Terminal delivery extent invalid');
 for(const index of T.quiescence.zeroFields)if(w[index]!==0)throw new Error(`GPU terminal quiescence failed at word ${index}`);
 for(const [a,b]of T.quiescence.equalPairs)if(w[a]!==w[b])throw new Error(`GPU terminal lease imbalance at words ${a}/${b}`);
 for(const [key,base]of [['id',T.fields.acceptedCommandIdBase],['generation',T.fields.acceptedCommandGenerationBase]])if(!identity(cancel[key]).every((v,i)=>w[base+i]===v))throw new Error('GPU terminal accepted cancel identity mismatch');
 return Object.freeze({quiescent:true,fields:Object.fromEntries(Object.entries(T.fields).filter(([,i])=>i<24).map(([name,index])=>[name,w[index]])),acceptedCancel:{id:[...cancel.id],generation:[...cancel.generation]}});
}
export function resolveExecutionPorts(core,requirements){
 const operationIds=Object.fromEntries(Object.entries(core.operationIds).map(([role,id])=>{const declared=core.operations.find(o=>o.id===id),matches=requirements.operationRequirements.filter(o=>o.function===declared?.entryPoint);if(matches.length!==1)throw new Error('Canonical operation callable must have one unique realization');return[role,matches[0].id];}));
 const deliveries=requirements.deliveryRequirements.filter(d=>d.packageDelivery===core.delivery.id);if(deliveries.length!==1)throw new Error('Canonical package delivery must have one unique realization');
 return {operationIds,deliveryId:deliveries[0].id};
}
export function createIgnitionResources(requirements,rootPacket,assets){
 const bindings=requirements.operationRequirements.flatMap(o=>o.bindings).filter(b=>b.source.kind==='resource'),needed=new Set([...bindings.map(b=>b.source.resource),...requirements.deliveryRequirements.map(d=>d.resource)]);
 const resources=Object.fromEntries(requirements.resourceRequirements.filter(r=>needed.has(r.id)).map(r=>{const n=Number(r.byteLength);if(!Number.isSafeInteger(n)||n<1||n>256*1024*1024)throw new Error('Resource allocation extent invalid');return[r.id,new Uint8Array(n)];}));
 const widths={u32:4,u64:8,i32:4,f32:4,f64:8,f16:2,bf16:2};
 for(const b of bindings){
  let bytes;if(b.parameter==='initialRootInput')bytes=rootPacket;else if(b.source.initialContentSha256){const a=assets[b.parameter];if(!a||a.sha256!==b.source.initialContentSha256)throw new Error('Immutable model input identity mismatch');bytes=a.bytes;}else continue;
  const view=b.source.view,parent=resources[b.source.resource],offset=Number(view?.byteOffset),length=Number(view?.elementCount)*widths[view?.dtype];if(!(bytes instanceof Uint8Array)||bytes.byteLength!==length||!parent||!Number.isSafeInteger(offset)||offset<0||offset+bytes.byteLength>parent.byteLength)throw new Error('Canonical initialization placement extent mismatch');parent.set(bytes,offset);
 }
 return resources;
}
