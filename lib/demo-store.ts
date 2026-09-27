import {newQuote,type Quote} from './quote';
import {applyQuoteAction} from './quote-actions';

// A deliberately temporary test session. No API requests, credentials, or saved
// account data enter this store. Each page instance starts independently.
export function createDemoStore(){
 const quotes=new Map<string,Quote>();
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
  const updated=applyQuoteAction(q,body);quotes.delete(q.id);quotes.set(q.id,structuredClone(updated));return updated;
 }};
}
