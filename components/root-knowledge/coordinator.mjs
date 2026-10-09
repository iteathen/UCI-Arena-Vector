import path from 'node:path';
import {createBookProvider} from './book.mjs';
import {createTablebaseCoordinator} from './tablebase-coordinator.mjs';
import {readBookBinding,admitBookBindingDocument} from './book-binding.mjs';

export function createRootKnowledgeCoordinator({bookProvider=createBookProvider(),environment=process.env,platform=process.platform,onStatus,loadTablebaseBinding,openTablebaseProvider,loadBookBinding=readBookBinding}={}){
 const tablebase=createTablebaseCoordinator({loadBinding:loadTablebaseBinding,openProvider:openTablebaseProvider,onStatus});
 const directory=environment.UCI_ARENA_KNOWLEDGE_ROOT?.trim()?path.join(environment.UCI_ARENA_KNOWLEDGE_ROOT,'opening_books'):environment.BOOK_FORGE_ROOT?.trim()?path.join(environment.BOOK_FORGE_ROOT,'published','integration'):platform==='win32'?path.join(environment.ProgramData??'C:/ProgramData','UCI Arena Manager','knowledge','opening_books'):'/var/lib/uci-arena/knowledge/opening_books';
 const options=Object.freeze([...([{name:'OwnBook',type:'check',default:true},{name:'BookFile',type:'string',default:path.join(directory,'strong_rare_v1.bin')},{name:'BookStatsFile',type:'string',default:path.join(directory,'strong_rare_v1.stats')},{name:'BookPolicyFile',type:'string',default:path.join(directory,'strong_rare_v1.policy')},{name:'BookSeed',type:'spin',default:0,min:0,max:2147483647},{name:'BookMaxPly',type:'spin',default:30,min:0,max:80}].map(o=>Object.freeze({...o,apply:'next-go'}))),Object.freeze({name:'BookSnapshotBinding',type:'string',default:'',apply:'startup'}),...tablebase.options]);
 let configured=Object.fromEntries(options.map(o=>[o.name,o.default])),loadedSignature,game,gameSignature,gameMaxPly,last,lastStatus,closed=false,reloadOnReady=true;
 let bookUsable=false,bindingFilename,binding,immutableActivated=false,gameBound=false,gameBookUsable=false,bookStatus,gameBookStatus;
 const admit=values=>{const next={};for(const option of options){const v=values[option.name]??option.default;if(option.type==='string'&&(typeof v!=='string'||v.length>4096||/[\x00-\x1f\x7f]/.test(v))||option.type==='check'&&typeof v!=='boolean'||option.type==='spin'&&(!Number.isSafeInteger(v)||v<option.min||v>option.max))throw new Error('Invalid root knowledge option');next[option.name]=v;}return next;};
 const signature=v=>JSON.stringify([v.BookFile,v.BookStatsFile,v.BookPolicyFile,v.BookSnapshotBinding]);
 const report=status=>{const encoded=JSON.stringify(status);if(encoded!==lastStatus){lastStatus=encoded;onStatus?.({schema:'vector_root_knowledge_status_v1',provider:'opening-book',status});}};
 const load=async(v,force=false)=>{
  const next=signature(v);
  if(!v.OwnBook){report({schema:'vector_book_provider_status_v1',active:false,retained:false,reason:'disabled',snapshot:null});return false;}
  try{
   if(game&&(gameBound||v.BookSnapshotBinding)){if(!gameBound||next!==gameSignature)throw new Error('BOOK_BINDING_GAME_CHANGED');bookUsable=gameBookUsable;report(gameBookStatus??{schema:'vector_book_provider_status_v1',active:false,retained:false,reason:'BOOK_BINDING_GAME_NOT_ADMITTED',snapshot:null});return false;}
   let files={bookFile:v.BookFile,statsFile:v.BookStatsFile,policyFile:v.BookPolicyFile};
   if(v.BookSnapshotBinding){
    if(bindingFilename!==v.BookSnapshotBinding){binding=admitBookBindingDocument(await loadBookBinding(v.BookSnapshotBinding));bindingFilename=v.BookSnapshotBinding;immutableActivated=false;}
    if(['BookFile','BookStatsFile','BookPolicyFile'].some((name,i)=>v[name]!==binding.files[['bookFile','statsFile','policyFile'][i]]))throw new Error('BOOK_BINDING_OPTION_MISMATCH');
    if(binding.authorityMode==='immutable_pinned_snapshot'&&immutableActivated&&loadedSignature===next)return false;
    files={...binding.files,...(binding.pin?.manifestSha256?{expectedManifestSha256:binding.pin.manifestSha256}:{}),...(binding.pin?.bookSha256?{expectedBookSha256:binding.pin.bookSha256}:{})};
   }
   if(!force&&loadedSignature===next)return false;
   const status=await bookProvider.reload(files);bookStatus=status;bookUsable=status.active===true;immutableActivated=bookUsable&&binding?.authorityMode==='immutable_pinned_snapshot';loadedSignature=next;report(status);return true;
  }catch{bookUsable=false;loadedSignature=next;report({schema:'vector_book_provider_status_v1',active:false,retained:false,reason:'BOOK_BINDING_INVALID_OR_UNAVAILABLE',snapshot:null});return false;}
 };
 return Object.freeze({options,
  hasOption(name){return options.some(o=>o.name===name);},
  async configure({name,value}){if(closed||!options.some(o=>o.name===name))throw new Error('Unsupported root knowledge option');if(game&&['RootTablebaseBinding','BookSnapshotBinding'].includes(name))throw new Error('Provider binding is startup-only during a game');if(game&&configured.BookSnapshotBinding&&['BookFile','BookStatsFile','BookPolicyFile'].includes(name)&&value!==configured[name])throw new Error('Bound Book selection is fixed during a game');const next=admit({...configured,[name]:value});if(name==='RootTablebaseBinding')tablebase.configure(value);if(name==='BookSnapshotBinding'){bindingFilename=undefined;binding=undefined;immutableActivated=false;loadedSignature=undefined;}configured=next;},
  async ready(){if(closed)throw new Error('Root knowledge closed');await load(configured,reloadOnReady);reloadOnReady=false;await tablebase.ready();},
  async beginGame(){if(closed||game)throw new Error('Root knowledge game lifecycle mismatch');await load(configured);game=bookProvider.beginGame({seed:configured.BookSeed,maxPly:configured.BookMaxPly});gameSignature=signature(configured);gameBound=Boolean(configured.BookSnapshotBinding);gameBookUsable=configured.OwnBook&&bookUsable;gameBookStatus=gameBookUsable?bookStatus:undefined;gameMaxPly=configured.BookMaxPly;last=undefined;},
  async onPosition(context){if(closed||!game)throw new Error('Root knowledge game is not active');last=undefined;tablebase.onPosition(context,configured.SyzygyRootProbe);},
  async prepare({context,requestId,options:values= configured,searchmoves=[]}){if(closed||!game)throw new Error('Root knowledge game is not active');const v=admit(values),key=JSON.stringify([context.rootEpoch,context.rootFence,requestId,searchmoves,v]);if(last?.key===key)return last.result;await load(v);if((!gameBound&&gameSignature!==signature(v))||(bookUsable&&gameMaxPly!==v.BookMaxPly)){await bookProvider.refreshGame({maxPly:v.BookMaxPly});if(!gameBound)gameSignature=signature(v);gameMaxPly=v.BookMaxPly;}const tb=tablebase.prepare({context,requestId,searchmoves,enabled:v.SyzygyRootProbe});const result=tb.result??(tb.applicable?{status:'unavailable',reason:'tablebase-pending'}:!v.OwnBook||!bookUsable||context.terminal?{status:'unavailable',reason:!v.OwnBook?'disabled':!bookUsable?'book_binding_unavailable':'terminal'}:game.resolve({context,searchmoves,tablebaseEligible:tb.applicable}));last={key,result,context,requestId};return result;},
  publication({context,requestId}){if(!last||last.requestId!==requestId||JSON.stringify(last.context)!==JSON.stringify(context))return null;return tablebase.publication({context,requestId})??last.result;},
  subscribeResolution(args,callback){return tablebase.subscribeResolution(args,callback);},
  async endGame(){tablebase.endGame();game?.close();game=undefined;last=undefined;reloadOnReady=true;},
  async close(){closed=true;game?.close();game=undefined;last=undefined;return tablebase.close();}
 });
}
