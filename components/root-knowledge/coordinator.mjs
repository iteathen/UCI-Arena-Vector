import path from 'node:path';
import {createBookProvider} from './book.mjs';

export function createRootKnowledgeCoordinator({bookProvider=createBookProvider(),environment=process.env,platform=process.platform,onStatus}={}){
 const directory=environment.UCI_ARENA_KNOWLEDGE_ROOT?.trim()?path.join(environment.UCI_ARENA_KNOWLEDGE_ROOT,'opening_books'):environment.BOOK_FORGE_ROOT?.trim()?path.join(environment.BOOK_FORGE_ROOT,'published','integration'):platform==='win32'?path.join(environment.ProgramData??'C:/ProgramData','UCI Arena Manager','knowledge','opening_books'):'/var/lib/uci-arena/knowledge/opening_books';
 const options=Object.freeze([{name:'OwnBook',type:'check',default:true},{name:'BookFile',type:'string',default:path.join(directory,'strong_rare_v1.bin')},{name:'BookStatsFile',type:'string',default:path.join(directory,'strong_rare_v1.stats')},{name:'BookPolicyFile',type:'string',default:path.join(directory,'strong_rare_v1.policy')},{name:'BookSeed',type:'spin',default:0,min:0,max:2147483647},{name:'BookMaxPly',type:'spin',default:30,min:0,max:80}].map(o=>Object.freeze({...o,apply:'next-go'})));
 let configured=Object.fromEntries(options.map(o=>[o.name,o.default])),loadedSignature,game,gameMaxPly,last,lastStatus,closed=false,reloadOnReady=true;
 const admit=values=>{const next={};for(const option of options){const v=values[option.name]??option.default;if(option.type==='string'&&(typeof v!=='string'||v.length>4096||/[\x00-\x1f\x7f]/.test(v))||option.type==='check'&&typeof v!=='boolean'||option.type==='spin'&&(!Number.isSafeInteger(v)||v<option.min||v>option.max))throw new Error('Invalid root knowledge option');next[option.name]=v;}return next;};
 const signature=v=>JSON.stringify([v.BookFile,v.BookStatsFile,v.BookPolicyFile]);
 const load=async(v,force=false)=>{const next=signature(v);if(!force&&loadedSignature===next)return false;const status=await bookProvider.reload({bookFile:v.BookFile,statsFile:v.BookStatsFile,policyFile:v.BookPolicyFile});loadedSignature=next;const encoded=JSON.stringify(status);if(encoded!==lastStatus){lastStatus=encoded;if(onStatus)onStatus({schema:'vector_root_knowledge_status_v1',provider:'opening-book',status});}return true;};
 return Object.freeze({options,
  hasOption(name){return options.some(o=>o.name===name);},
  async configure({name,value}){if(closed||!options.some(o=>o.name===name))throw new Error('Unsupported root knowledge option');configured=admit({...configured,[name]:value});},
  async ready(){if(closed)throw new Error('Root knowledge closed');await load(configured,reloadOnReady);reloadOnReady=false;},
  async beginGame(){if(closed||game)throw new Error('Root knowledge game lifecycle mismatch');await load(configured);game=bookProvider.beginGame({seed:configured.BookSeed,maxPly:configured.BookMaxPly});gameMaxPly=configured.BookMaxPly;last=undefined;},
  async prepare({context,requestId,options:values= configured,searchmoves=[]}){if(closed||!game)throw new Error('Root knowledge game is not active');const v=admit(values),key=JSON.stringify([context.rootEpoch,context.rootFence,requestId,searchmoves,v]);if(last?.key===key)return last.result;const changed=await load(v);if(changed||gameMaxPly!==v.BookMaxPly){await bookProvider.refreshGame({maxPly:v.BookMaxPly});gameMaxPly=v.BookMaxPly;}const result=!v.OwnBook||context.terminal?{status:'unavailable',reason:!v.OwnBook?'disabled':'terminal'}:game.resolve({context,searchmoves});last={key,result};return result;},
  async endGame(){game?.close();game=undefined;last=undefined;reloadOnReady=true;},
  async close(){if(closed)return;closed=true;game?.close();game=undefined;last=undefined;}
 });
}
