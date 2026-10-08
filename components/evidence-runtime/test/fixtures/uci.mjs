// Portable protocol fixture only; never hardware/model evidence.
import readline from 'node:readline';
const lines=readline.createInterface({input:process.stdin});
lines.on('line',line=>{
  if(line==='uci')console.log('id name protocol-fixture\nuciok');
  else if(line==='isready')console.log('info string vector_identity {"schema":"vector_engine_runtime_identity_v1","nodeVersion":"'+process.versions.node+'","fixture":true}\nreadyok');
  else if(line.startsWith('go ')&&process.argv[2]!=='silent')console.log('info depth 1 nodes 1\nbestmove e2e4');
  else if(line==='quit') {
    if(process.argv[2]==='delayed-quit')setTimeout(()=>process.exit(0),700);
    else process.exit(process.argv[2]==='abnormal-quit'?7:0);
  }
});
