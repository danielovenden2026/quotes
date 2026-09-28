import {totals,type Quote} from './quote';
import {quotePostcode} from './quote-filters';
function cell(value:string){
 // Treat customer-entered text as text when opened in spreadsheet software.
 const safe=/^[\s\u0000-\u001f]*[=+@-]/.test(value)?"'"+value:value;
 return '"'+safe.replaceAll('"','""')+'"';
}
export function quotesCsv(quotes:Quote[],gp:Record<string,{pct:number|null}>,quoteUrl:(quote:Quote)=>string){
 const header=['Date','Quote #','Customer','Postcode','Total quote amount (AUD incl. GST)','Product GP (%)','Quote link'].map(cell).join(',');
 const rows=quotes.map(q=>{
  const pct=gp[q.id]?.pct;
  return [cell(q.date),cell(q.number),cell(q.company||q.contact||'New customer'),cell(quotePostcode(q)),(totals(q).total/100).toFixed(2),pct!=null&&Number.isFinite(pct)?pct.toFixed(1):cell('N/A'),cell(quoteUrl(q))].join(',');
 });
 return '\uFEFF'+[header,...rows].join('\r\n')+'\r\n';
}
