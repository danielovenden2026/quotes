import {totals,type Quote} from './quote';
export type QuoteFilters={from:string;to:string;minPrice:string;maxPrice:string;minGp:string;maxGp:string;startPostcode:string;endPostcode:string};
export const emptyQuoteFilters:QuoteFilters={from:'',to:'',minPrice:'',maxPrice:'',minGp:'',maxGp:'',startPostcode:'',endPostcode:''};
export function quoteFilterError(f:QuoteFilters){
 if([f.startPostcode,f.endPostcode].some(v=>v!==''&&!/^\d{4}$/.test(v)))return 'Enter a four-digit postcode, including any leading zero.';
 if(f.startPostcode&&f.endPostcode&&Number(f.startPostcode)>Number(f.endPostcode))return 'The start postcode must not exceed the end postcode.';
 if(f.from&&f.to&&f.from>f.to)return 'The start date must be on or before the end date.';
 for(const [min,max,name] of [[f.minPrice,f.maxPrice,'amount'],[f.minGp,f.maxGp,'GP']] as const){
  if([min,max].some(v=>v!==''&&!Number.isFinite(Number(v))))return 'Enter a valid '+name+' range.';
  if(min!==''&&max!==''&&Number(min)>Number(max))return 'Minimum '+name+' must not exceed maximum '+name+'.';
 }
 if([f.minPrice,f.maxPrice].some(v=>v!==''&&Number(v)<0))return 'Quote amounts must be zero or greater.';
 return '';
}
export function matchesQuoteFilters(q:Quote,pct:number|null|undefined,f:QuoteFilters){
 if(quoteFilterError(f))return false;
 if((f.from&&q.date<f.from)||(f.to&&q.date>f.to))return false;
 if(f.startPostcode||f.endPostcode){
  const postcode=quotePostcode(q);if(!/^\d{4}$/.test(postcode))return false;
  if((f.startPostcode&&Number(postcode)<Number(f.startPostcode))||(f.endPostcode&&Number(postcode)>Number(f.endPostcode)))return false;
 }
 const amount=totals(q).total;
 if((f.minPrice!==''&&amount<Math.round(Number(f.minPrice)*100))||(f.maxPrice!==''&&amount>Math.round(Number(f.maxPrice)*100)))return false;
 if(f.minGp!==''||f.maxGp!==''){
  if(pct===null||pct===undefined||!Number.isFinite(pct))return false;
  // Match the displayed one-decimal GP, including exact range boundaries.
  const shown=Math.round(pct*10)/10;
  if((f.minGp!==''&&shown<Number(f.minGp))||(f.maxGp!==''&&shown>Number(f.maxGp)))return false;
 }
 return true;
}

export function quotePostcode(q:Quote){return (q.postcode||'').trim();}
export type QuoteSortKey='date'|'number'|'amount'|'gp'|'postcode';
export type QuoteSort={key:QuoteSortKey;direction:'asc'|'desc'};
export function compareQuotes(a:Quote,b:Quote,sort:QuoteSort,gp:Record<string,{pct:number|null}>){
 let result=0;
 if(sort.key==='postcode'){
  const av=quotePostcode(a),bv=quotePostcode(b),aMissing=!/^\d{4}$/.test(av),bMissing=!/^\d{4}$/.test(bv);
  if(aMissing!==bMissing)return aMissing?1:-1;
  result=aMissing?0:Number(av)-Number(bv);
 }else if(sort.key==='gp'){
  const av=gp[a.id]?.pct,bv=gp[b.id]?.pct;
  const aMissing=av==null||!Number.isFinite(av),bMissing=bv==null||!Number.isFinite(bv);
  // Missing GP always stays at the bottom, in either direction.
  if(aMissing!==bMissing)return aMissing?1:-1;
  result=aMissing?0:av!-bv!;
 }else if(sort.key==='amount')result=totals(a).total-totals(b).total;
 else if(sort.key==='number')result=a.number.localeCompare(b.number,'en-AU',{numeric:true,sensitivity:'base'});
 else result=a.date.localeCompare(b.date);
 return (sort.direction==='asc'?result:-result)||a.id.localeCompare(b.id);
}
