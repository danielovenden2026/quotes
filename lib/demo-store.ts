import {freightFingerprint} from './freight';
import {lineKey,newQuote,type Quote} from './quote';
import {applyQuoteAction} from './quote-actions';

// A deliberately temporary test session. No API requests, credentials, or saved
// account data enter this store. Each page instance starts independently.
export function createDemoStore(seed?:Quote){
 const quotes=new Map<string,Quote>();
 if(seed)quotes.set(seed.id,structuredClone(seed));
 return {async request(url:string,body?:any,method='POST'):Promise<any>{
  if(url==='/api/quotes'){
   if(!body)return structuredClone([...quotes.values()].reverse());
   const id=Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');const q=newQuote(!!body.demo,id);q.number='DEMO-'+q.id.slice(0,8).toUpperCase();
   q.events=[{at:new Date().toISOString(),text:body.demo?'ABC sample loaded for this demo session':'Demo draft created'}];
   quotes.set(q.id,structuredClone(q));return q;
  }
  const match=/^\/api\/quotes\/([a-f0-9-]+)$/.exec(url);
  if(!match)throw new Error('This action is not available in the shared demo.');
  const q=quotes.get(match[1]);if(!q)throw new Error('Demo quote not found. Refresh to start again.');
  if(!body)return structuredClone(q);
  if(method!=='PATCH')throw new Error('Unsupported demo action.');
  const updated=applyQuoteAction(q,body.action==='customer-freight'?{...body,action:'customer'}:body);
  if(body.action==='customer-freight'){
   const estimate=body.freightEstimate;
   if(!estimate||estimate.fingerprint!==freightFingerprint(updated)||!Number.isSafeInteger(estimate.amount)||estimate.amount<0)throw Error('The shipment changed. Refresh freight again.');
   updated.freight=estimate.amount;updated.freightEstimate=estimate;
   updated.events.at(-1)!.text+='; delivery freight refreshed in this demo';
  }
  // Only this in-memory demo store retains user-entered test costs. Live quote
  // validation deliberately strips this field and never trusts it for GP.
  if(body.action==='save')updated.items=updated.items.map(item=>{
   const source=body.quote?.items?.find((i:any)=>lineKey(i)===lineKey(item));
   const cost=source?.demoCost;
   if(source?.demoCostLineId&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(source.demoCostLineId))item={...item,demoCostLineId:source.demoCostLineId};
   if(cost===undefined)return item;
   if(!Number.isSafeInteger(cost)||cost<0||cost>100000000)throw Error('Invalid demo cost');
   return {...item,demoCost:cost};
  });quotes.delete(q.id);quotes.set(q.id,structuredClone(updated));return updated;
 }};
}
