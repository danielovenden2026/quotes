import 'server-only';
import {reviewMargins} from './margin-review';
import {getGpSettings} from './gp-settings';
import {getApprovalSettings} from './approval-settings';
import {lineKey,totals,money,type Quote} from './quote';
import type {Actor} from './workspace-access';
export async function quoteRules(q:Quote,request:Request,quoteOwner?:string){
 const [{minimumSavePct},{highValueCents},margins]=await Promise.all([getGpSettings(),getApprovalSettings(),reviewMargins(q.items,request,quoteOwner)]);
 const blockedLines=margins.lines.filter((line,index)=>q.items[index].qty>0&&(!q.items[index].optional||!q.items[index].autoOptionFor||q.items[index].selected)&&line.pct!==null&&line.pct<minimumSavePct-1e-9).map(line=>line.lineId||line.sku);
 const unknownLines=margins.lines.filter((line,index)=>q.items[index].qty>0&&(!q.items[index].optional||!q.items[index].autoOptionFor||q.items[index].selected)&&line.pct===null).map(line=>line.lineId||line.sku);
 return {blockedLines,unknownLines,minimumSavePct,highValueCents,highValue:totals(q).total>highValueCents,margins};
}
export function checkDiscountPermission(previous:Quote,next:Quote,user:Actor){
 if(user.permissions.applyDiscounts)return;
 const old=new Map(previous.items.map(i=>[lineKey(i),i]));
 for(const i of next.items){const prior=old.get(lineKey(i));if(JSON.stringify(i.discount||null)!==JSON.stringify(prior?.discount||null)||i.discount?.value&&prior?.price!==i.price)throw Error('You do not have permission to apply or change item discounts.');}
}
export async function enforceQuoteRules(q:Quote,previous:Quote,request:Request,user:Actor,action:string,quoteOwner:string){
 if(action!=='save'&&action!=='ready')return;
 if(action==='save')checkDiscountPermission(previous,q,user);
 const rules=await quoteRules(q,request,quoteOwner);
 if(rules.blockedLines.length&&!user.permissions.approveRestricted)throw Error('Saving blocked: '+rules.blockedLines.length+' line(s) are below '+rules.minimumSavePct+'% GP. An Administrator/approver must save this quote.');
 if(action==='ready'&&!user.permissions.approveRestricted){
  if(rules.highValue)throw Error('This quote exceeds '+money(rules.highValueCents)+' including GST. Request Administrator/approver approval.');
  if(rules.unknownLines.length)throw Error('GP could not be verified for every line. An Administrator/approver must approve this quote.');
 }
 if(action==='ready'&&(rules.highValue||rules.blockedLines.length||rules.unknownLines.length))q.events.push({at:new Date().toISOString(),text:'Approved by '+user.name+' ('+user.email+').'+(rules.highValue?' High-value approval above '+money(rules.highValueCents)+'.':'')+(rules.blockedLines.length?' Margin override below '+rules.minimumSavePct+'% GP.':'')+(rules.unknownLines.length?' Approved with unavailable GP.':'')});
 if(action==='save'&&rules.blockedLines.length)q.events.push({at:new Date().toISOString(),text:'Margin override: saved by '+user.name+' ('+user.email+') with '+rules.blockedLines.length+' line(s) below '+rules.minimumSavePct+'% GP.'});
}
