import { createHash } from 'node:crypto';
import { buildDomainDeviceModule } from '../chess-domain/device.mjs';
import { STATE_WORDS,HEADER_WORDS,MAX_ACTIONS } from '../chess-domain/admission.mjs';
export function buildEngineDomainModule(){
  const domain=buildDomainDeviceModule();
  const source=domain.source+`
function vDomainValid(s,b,domainScratch) {
  let count=s[b+gpu.u32(69)];if(count===gpu.u32(0)||count>gpu.u32(256)||s[b+gpu.u32(68)]===gpu.u32(0)||s[b+gpu.u32(70)]>gpu.u32(64)||!cValidBoard(s,b)){return false;}
  for(let j=gpu.u32(0);j<gpu.u32(67);j++){domainScratch[j]=s[b+j];}domainScratch[gpu.u32(66)]=s[b+gpu.u32(70)];if(!cValidBoard(domainScratch,gpu.u32(0))){return false;}
  for(let n=gpu.u32(0);n<count;n++){if(!cValidBoard(s,b+gpu.u32(71)+n*gpu.u32(67))){return false;}}
  for(let j=gpu.u32(0);j<gpu.u32(67);j++){if(s[b+j]!==s[b+gpu.u32(71)+(count-gpu.u32(1))*gpu.u32(67)+j]){return false;}}
  return true;
}
function vDomainActions(s,b,a,ab,capacity,domainScratch) {
  if(capacity>gpu.u32(256)){return gpu.u32(4294967295);}let count=gpu.u32(0);let side=s[b+gpu.u32(64)];
  for(let from=gpu.u32(0);from<gpu.u32(64);from++){let piece=s[b+from];if(piece===gpu.u32(0)||cColor(piece)!==side){continue;}
    for(let to=gpu.u32(0);to<gpu.u32(64);to++){let first=gpu.u32(0);let last=gpu.u32(0);if(cType(piece)===gpu.u32(1)&&(to/gpu.u32(8)===gpu.u32(0)||to/gpu.u32(8)===gpu.u32(7))){first=gpu.u32(1);last=gpu.u32(4);}
      for(let promotion=first;promotion<=last;promotion++){if(cLegal(s,b,domainScratch,gpu.u32(0),from,to,promotion)){if(count>=capacity){return gpu.u32(4294967295);}a[ab+count]=from|(to<<gpu.u32(6))|(promotion<<gpu.u32(12));count++;}}
    }
  }return count;
}
function vDomainActionValid(s,b,a,ab,domainScratch){let action=a[ab];if(action>=gpu.u32(32768)){return false;}return cLegal(s,b,domainScratch,gpu.u32(0),action&gpu.u32(63),(action>>gpu.u32(6))&gpu.u32(63),(action>>gpu.u32(12))&gpu.u32(7));}
function vDomainActionEqual(a,ab,other,ob){return a[ab]===other[ob];}
function vDomainApply(s,b,a,ab,d,db,domainScratch){return cApply(s,b,d,db,domainScratch,gpu.u32(0),a[ab]);}
function vDomainHasAction(s,b,domainScratch){let side=s[b+gpu.u32(64)];for(let from=gpu.u32(0);from<gpu.u32(64);from++){let piece=s[b+from];if(piece===gpu.u32(0)||cColor(piece)!==side){continue;}for(let to=gpu.u32(0);to<gpu.u32(64);to++){let first=gpu.u32(0);let last=gpu.u32(0);if(cType(piece)===gpu.u32(1)&&(to/gpu.u32(8)===gpu.u32(0)||to/gpu.u32(8)===gpu.u32(7))){first=gpu.u32(1);last=gpu.u32(4);}for(let promotion=first;promotion<=last;promotion++){if(cLegal(s,b,domainScratch,gpu.u32(0),from,to,promotion)){return true;}}}}return false;}
function vDomainTerminal(s,b,out,ob,domainScratch){let reason=gpu.u32(0);let claims=gpu.u32(0);let repetitions=cRepetitions(s,b);if(s[b+gpu.u32(67)]>=gpu.u32(100)){claims=claims|gpu.u32(1);}if(repetitions>=gpu.u32(3)){claims=claims|gpu.u32(2);}if(!vDomainHasAction(s,b,domainScratch)){reason=gpu.u32(2);if(cAttacked(s,b,cKing(s,b,s[b+gpu.u32(64)]),gpu.u32(1)-s[b+gpu.u32(64)])){reason=gpu.u32(1);}}else if(s[b+gpu.u32(67)]>=gpu.u32(150)){reason=gpu.u32(3);}else if(repetitions>=gpu.u32(5)){reason=gpu.u32(4);}else if(cInsufficient(s,b)){reason=gpu.u32(5);}out[ob]=reason;out[ob+gpu.u32(1)]=s[b+gpu.u32(64)];out[ob+gpu.u32(2)]=claims;if(reason!==gpu.u32(0)){return gpu.u32(1);}return gpu.u32(0);}
function vDomainRelation(s,b,ancestor,ab){if(cEqual(s,b,ancestor,ab)){return gpu.u32(1);}return gpu.u32(0);}
`;
  const fn=(name,params,returns)=>({name,kind:'device',parameters:params.map(([name,type])=>({name,type})),returns}),s=['s','ptr<u32>'],b=['b','u32'],scratch=['domainScratch','ptr<u32>'];
  return{source,functions:[...domain.functions,fn('vDomainValid',[s,b,scratch],'bool'),fn('vDomainActions',[s,b,['a','ptr<u32>'],['ab','u32'],['capacity','u32'],scratch],'u32'),fn('vDomainActionValid',[s,b,['a','ptr<u32>'],['ab','u32'],scratch],'bool'),fn('vDomainActionEqual',[['a','ptr<u32>'],['ab','u32'],['other','ptr<u32>'],['ob','u32']],'bool'),fn('vDomainApply',[s,b,['a','ptr<u32>'],['ab','u32'],['d','ptr<u32>'],['db','u32'],scratch],'u32'),fn('vDomainHasAction',[s,b,scratch],'bool'),fn('vDomainTerminal',[s,b,['out','ptr<u32>'],['ob','u32'],scratch],'u32'),fn('vDomainRelation',[s,b,['ancestor','ptr<u32>'],['ab','u32']],'u32')],stateWords:STATE_WORDS,actionWords:1,outcomeWords:3,drawProfile:'orthodox_live_claims_v1',scratchWords:HEADER_WORDS,maximumActions:MAX_ACTIONS,hooks:{validateRoot:'vDomainValid',key:'cIdentity',equalState:'cEqual',actions:'vDomainActions',actionValid:'vDomainActionValid',actionEqual:'vDomainActionEqual',transition:'vDomainApply',terminal:'vDomainTerminal',relation:'vDomainRelation'},sourceIdentity:{algorithm:'sha256',sha256:createHash('sha256').update(source.replace(/\r\n?/g,'\n').replace(/\n+$/g,'')+'\n').digest('hex')}};
}
