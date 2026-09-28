'use client';
import {useEffect,useState} from 'react';
import {Filter,Download,ArrowUp,ArrowDown,ArrowUpDown,ArrowRight,FileText,Plus,RefreshCw,Search} from 'lucide-react';
import {Table,TableHeader,TableHead,TableRow,TableBody,TableCell} from '@/components/ui/table';
import {dateLabel,money,totals,type Quote} from '@/lib/quote';
import {toast} from 'sonner';
import {quotesCsv} from '@/lib/quote-csv';
import {reviewDemoMargins} from '@/lib/demo-margins';
import {emptyQuoteFilters,quotePostcode,matchesQuoteFilters,quoteFilterError,compareQuotes,type QuoteSort,type QuoteSortKey,type QuoteFilters} from '@/lib/quote-filters';
type QuoteGp={pct:number|null;low:boolean;reason:string};
export default function QuotesWorkspace({quotes,loading,error,demo,busy,onOpen,onRefresh,onCreate,liveDemoData=false,demoMetrics='',gpTarget=40,canCreate=true,canViewGp=true}:{quotes:Quote[];loading:boolean;error:string;demo:boolean;busy:boolean;onOpen:(quote:Quote)=>void;onRefresh:()=>void;onCreate:()=>void;liveDemoData?:boolean;demoMetrics?:string;gpTarget?:number;canCreate?:boolean;canViewGp?:boolean}){
 const [sort,setSort]=useState<QuoteSort>({key:'date',direction:'desc'});
 const [search,setSearch]=useState(''),[filters,setFilters]=useState<QuoteFilters>(emptyQuoteFilters),[draftFilters,setDraftFilters]=useState<QuoteFilters>(emptyQuoteFilters);
 const [gp,setGp]=useState<Record<string,QuoteGp>>({}),[gpLoading,setGpLoading]=useState(true),[gpError,setGpError]=useState('');
 useEffect(()=>{
  if(!canViewGp){setGp({});setGpError('');setGpLoading(false);return;}
  const controller=new AbortController();setGpLoading(true);setGpError('');setGp({});
  async function load(){try{
   if(demo&&!liveDemoData){setGp(Object.fromEntries(quotes.map(q=>[q.id,reviewDemoMargins(q.items,gpTarget).overall])));return;}
   if(demo){
    const values:Record<string,QuoteGp>={};
    // Each request uses the existing, explicitly shared demo product scope.
    for(const q of quotes){
     const items=q.items.map(({lineId,sku,price,discount,qty,optional,selected,demoCost,demoCostLineId})=>({lineId,sku,price,discount,qty,optional,selected,demoCost,demoCostLineId}));
     const response=await fetch(demoMetrics+'quote-gp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items}),cache:'no-store',signal:controller.signal});
     if(!response.ok)throw Error();values[q.id]=await response.json();
    }
    if(!controller.signal.aborted)setGp(values);
   }else{
    const response=await fetch('/api/workspace/quote-gp',{cache:'no-store',signal:controller.signal});
    if(!response.ok)throw Error();const data=await response.json() as {gp:Record<string,QuoteGp>};
    if(!controller.signal.aborted)setGp(data.gp);
   }
  }catch{if(!controller.signal.aborted)setGpError('GP could not be loaded. Use Refresh to try again.');}finally{if(!controller.signal.aborted)setGpLoading(false);}}
  void load();return ()=>controller.abort();
 },[quotes,demo,liveDemoData,demoMetrics,gpTarget,canViewGp]);
 const invalid=quoteFilterError(draftFilters),pendingFilters=JSON.stringify(draftFilters)!==JSON.stringify(filters),hasFilters=!!search||Object.values(filters).some(Boolean),waiting=loading||(gpLoading&&(filters.minGp!==''||filters.maxGp!==''));
 const results=quotes.filter(q=>(q.number+' '+q.company+' '+q.contact).toLowerCase().includes(search.trim().toLowerCase())&&matchesQuoteFilters(q,gp[q.id]?.pct,filters)).sort((a,b)=>compareQuotes(a,b,sort,gp));
 function exportCsv(){
  if(loading||gpLoading||!results.length)return;
  try{
   const csv=quotesCsv(results,gp,q=>demo?'':window.location.origin+'/workspace?id='+encodeURIComponent(q.id));
   const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
   const link=document.createElement('a');link.href=url;link.download='Verdex-Quotes-'+new Date().toISOString().slice(0,10)+(hasFilters?'-filtered':'')+'.csv';document.body.appendChild(link);
   try{link.click();}finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
   toast.success('Exported '+results.length+' '+(results.length===1?'quote':'quotes')+' to CSV');
  }catch{toast.error('The CSV could not be downloaded. Please try again.');}
 }
 function field(key:keyof QuoteFilters,label:string,type:'date'|'number'|'text',placeholder?:string){return <label className="field"><span>{label}</span><input className={type==='number'?'workspace-number-input':undefined} inputMode={type==='number'?'decimal':type==='text'?'numeric':undefined} maxLength={type==='text'?4:undefined} pattern={type==='text'?'[0-9]{4}':undefined} type={type} step={type==='number'?(key.includes('Price')?'0.01':'0.1'):undefined} min={key.includes('Price')?'0':undefined} placeholder={placeholder} value={draftFilters[key]} onChange={e=>setDraftFilters(v=>({...v,[key]:e.target.value}))}/></label>;}
 function heading(key:QuoteSortKey,label:string,numeric=false,note?:string){
  const active=sort.key===key,next=active?(sort.direction==='asc'?'desc':'asc'):key==='number'||key==='postcode'?'asc':'desc';
  const Icon=active?(sort.direction==='asc'?ArrowUp:ArrowDown):ArrowUpDown;
  return <TableHead className={numeric?'quote-amount':undefined} aria-sort={active?(sort.direction==='asc'?'ascending':'descending'):'none'}><button type="button" className="quote-sort-button" onClick={()=>setSort({key,direction:next})} aria-label={'Sort by '+label+', '+(next==='asc'?'ascending':'descending')}><div>{label}{note&&<small>{note}</small>}</div><Icon size={15} aria-hidden="true"/></button></TableHead>;
 }
 return <main className="page-shell quotes-workspace"><div className="quotes-workspace-heading"><div><div className="eyebrow dark">VERDEX QUOTES</div><h1>Quote Reports</h1></div><button className="btn primary" disabled={busy||!canCreate} onClick={onCreate}><Plus size={17}/>New quote</button></div>
 {demo&&<p className="notice">Quotes in this demo session only. Changes last until you refresh or close the page.</p>}
 <section className="card quotes-workspace-card" aria-label="Saved quotes"><div className="quotes-workspace-toolbar"><div className="search-box"><Search size={18} aria-hidden="true"/><input aria-label="Search saved quotes" placeholder="Search quote number or customer" value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="quote-export-actions"><button type="button" className="btn outline" disabled={loading||gpLoading||!results.length} onClick={exportCsv} title="Export the displayed quotes in the current sort order"><Download size={16}/>Export CSV</button><button className="btn outline" disabled={loading||gpLoading} onClick={onRefresh}><RefreshCw size={16}/>{loading||gpLoading?'Refreshing…':'Refresh'}</button></div></div>
 <form onSubmit={e=>{e.preventDefault();if(!invalid)setFilters({...draftFilters});}}><div className="quote-range-filters"><fieldset><legend>Date range</legend><div>{field('from','From','date')}{field('to','To','date')}</div></fieldset><fieldset><legend>Total amount · AUD incl. GST</legend><div>{field('minPrice','Minimum amount','number','No minimum')}{field('maxPrice','Maximum amount','number','No maximum')}</div></fieldset><fieldset><legend>Postcode range</legend><div>{field('startPostcode','Start postcode','text','e.g. 2000')}{field('endPostcode','End postcode','text','e.g. 2999')}</div></fieldset>{canViewGp&&<fieldset><legend>Product GP%</legend><div>{field('minGp','Minimum GP%','number','No minimum')}{field('maxGp','Maximum GP%','number','No maximum')}</div></fieldset>}</div>
 <div className="quote-filter-help"><span>Product GP uses current costs and excludes freight, handling and GST.</span><div className="quote-filter-actions">{pendingFilters&&<span role="status">Filters not yet applied</span>}<button type="button" className="text-button" disabled={!hasFilters&&!pendingFilters} onClick={()=>{setFilters(emptyQuoteFilters);setDraftFilters(emptyQuoteFilters);setSearch('');}}>Clear filters</button><button type="submit" className="btn primary" disabled={!!invalid}><Filter size={16} aria-hidden="true"/>Apply filters</button></div></div></form>
 {(error||gpError||invalid)&&<p className="price-warning" role="alert">{[error,gpError,invalid].filter(Boolean).join(' ')}</p>}
 <Table className="quotes-workspace-table"><TableHeader><TableRow>{heading('date','Date')}{heading('number','Quote #')}{heading('postcode','Postcode')}{heading('amount','Total quote amount',true,'(inc. GST)')}{canViewGp&&heading('gp','GP%',true)}<TableHead>Status</TableHead><TableHead><span className="sr-only">View quote</span></TableHead></TableRow></TableHeader><TableBody>{results.map(q=><TableRow key={q.id}><TableCell className="quote-date">{dateLabel(q.date)}</TableCell><TableCell><strong>{q.number}</strong><small className="quote-customer">{q.company||q.contact||'New customer'}</small></TableCell><TableCell className="quote-postcode">{quotePostcode(q)||'—'}</TableCell><TableCell className="quote-amount"><strong>{money(totals(q).total)}</strong></TableCell>{canViewGp&&<TableCell className="quote-amount"><span className={'quote-gp-value '+(gp[q.id]?.low?'low':'')} title={gp[q.id]?.reason||gpError}>{gpLoading?'Loading…':gp[q.id]?.pct!=null?gp[q.id].pct!.toFixed(1)+'%':'N/A'}</span></TableCell>}<TableCell><span className={'status '+q.status.toLowerCase().replaceAll(' ','-')}>{q.status}</span></TableCell><TableCell className="quote-action">{demo?<button className="btn outline" onClick={()=>onOpen(q)} aria-label={'View quote '+q.number}>View quote<ArrowRight size={16}/></button>:<a className="btn outline" href={'/workspace?id='+encodeURIComponent(q.id)} aria-label={'View quote '+q.number} onClick={e=>{if(e.button===0&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey){e.preventDefault();onOpen(q);}}}>View quote<ArrowRight size={16}/></a>}</TableCell></TableRow>)}</TableBody></Table>
 {!results.length&&<div className="empty-state"><FileText size={30}/><h3>{waiting?'Loading quotes…':hasFilters?'No matching quotes':'No saved quotes yet'}</h3><p>{waiting?'Please wait while quote data loads.':hasFilters?'Adjust or clear the filters to see more quotes.':'Create a quote to get started.'}</p></div>}
 <div className="quotes-workspace-count" role="status">{waiting?'Loading saved quotes…':results.length+' of '+quotes.length+' quotes'}</div></section></main>;
}
