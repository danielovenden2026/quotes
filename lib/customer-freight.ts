import 'server-only';
import {applyQuoteAction} from './quote-actions';
import {freightInput,freightFingerprint,isFreightOnlyHold} from './freight';
import {type Quote,money} from './quote';
import {getMagentoSettings,estimateMagento} from './magento-freight';

// Client-supplied prices, address, freight amounts and estimate metadata are never used.
const running=new Set<string>();
export async function refreshCustomerFreight(current:Quote,body:any):Promise<Quote>{
 if(running.has(current.id))throw Error('A freight calculation is already running. Please wait.');
 running.add(current.id);
 try{return await calculate(current,body);}finally{running.delete(current.id);}
}
async function calculate(current:Quote,body:any):Promise<Quote>{
 const source=isFreightOnlyHold(current)?{...current,status:'Ready'}:current;
 const next=applyQuoteAction(source,{...body,action:'customer'});
 if((next.fulfilmentMethod||'delivery')!=='delivery')throw Error('Select delivery before refreshing freight.');
 const settings=await getMagentoSettings();
 if(!settings.enabled)throw Error('Online freight calculation is unavailable. Please contact the sales team.');
 const rates=await estimateMagento(settings.storeCode,freightInput(next));
 const previous=current.freightEstimate;
 const rate=previous?.carrierCode?rates.find(r=>r.carrierCode===previous.carrierCode&&r.methodCode===previous.methodCode):rates[0];
 if(!rate)throw Error('The quoted delivery service is unavailable. Please contact the sales team.');
 next.freight=rate.amount;
 next.freightEstimate={...rate,fingerprint:freightFingerprint(next),calculatedAt:new Date().toISOString()};
 next.events[next.events.length-1].text=next.events[next.events.length-1].text.replace('; delivery freight refresh required before acceptance','')+'; customer refreshed delivery freight to '+money(rate.amount)+' ex GST';
 return next;
}
