// Portable protocol fixture only; never hardware/model evidence.
import readline from 'node:readline';
const lines=readline.createInterface({input:process.stdin});
lines.on('line',line=>{
  if(line==='uci')console.log('id name protocol-fixture\nuciok');
  else if(line==='isready')console.log('info string vector_identity {"schema":"vector_engine_runtime_identity_v1","nodeVersion":"'+process.versions.node+'","fixture":true}\nreadyok');
  else if(line.startsWith('go ')&&process.argv[2]!=='silent'){
    if(process.argv[2]==='opaque-clock-info'){console.log('info string vector_clock_phase ordinary opaque text\nbestmove e2e4');return;}
    if(process.argv[2]==='late-clock-diagnostic'){
      const phase=phase=>console.log('info string vector_clock_phase '+JSON.stringify({schema:'vector_uci_clock_phase_v1',phase,rootEpoch:1,requestId:1,time:performance.now(),fixture:true}));
      phase('goReceived');console.log('bestmove e2e4');setTimeout(()=>phase('emit'),50);
    }else console.log('info depth 1 nodes 1\nbestmove e2e4');
  }
  else if(line==='quit') {
    if(['teardown','duplicate-teardown','invalid-teardown'].includes(process.argv[2])){
      // Synthetic protocol data; readiness identity stays fixture:true, so the
      // physical artifact adapter rejects this process as qualification evidence.
      const receipt={schema:'vector_engine_teardown_v1',joined:false,cleanup:{status:'complete',failures:[],runtime:{graceful:true,driver:{resourceCounts:{live:0,orphaned:0,closed:1}}}}};
      console.log('info string vector_teardown '+(process.argv[2]==='invalid-teardown'?'invalid-json':JSON.stringify(receipt)));
      if(process.argv[2]==='duplicate-teardown')console.log('info string vector_teardown '+JSON.stringify(receipt));
    }
    if(process.argv[2]==='delayed-quit')setTimeout(()=>process.exit(0),700);
    else process.exit(process.argv[2]==='abnormal-quit'?7:0);
  }
});
