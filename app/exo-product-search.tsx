'use client';
import {useEffect,useState} from 'react';
import {Search,Plus,Package} from 'lucide-react';
import {money,type Item} from '@/lib/quote';
export default function ExoProductSearch({active,onActivate,onAdd,disabled}:{active:boolean;onActivate:()=>void;onAdd:(item:Item)=>void;disabled:boolean}){
 const [query,setQuery]=useState(''),[retry,setRetry]=useState(0),[result,setResult]=useState<{products:Item[];total:number}|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
 useEffect(()=>{if(!active)return;setResult(null);setError('');if(!query.trim()){setLoading(false);return;}const controller=new AbortController();setLoading(true);
 const timer=setTimeout(async()=>{try{const r=await fetch('/api/workspace/exo-products?q='+encodeURIComponent(query.trim()),{cache:'no-store',signal:controller.signal});const data=await r.json() as {products:Item[];total:number;error?:string};if(!r.ok)throw Error(data.error||'EXO products could not be loaded.');if(!controller.signal.aborted)setResult(data);}catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'EXO search could not be loaded.');}finally{if(!controller.signal.aborted)setLoading(false);}},250);
 return()=>{clearTimeout(timer);controller.abort();};},[query,active,retry]);
 return <section className="exo-product-search"><div className={'search-box '+(active?'active-source':'')}><Search size={17}/><input aria-label="Search EXO Stock items" placeholder="EXO Stock items" maxLength={100} value={query} onFocus={onActivate} onChange={e=>{onActivate();setQuery(e.target.value);}}/></div>
 {active&&<div className="exo-search-results">{!query.trim()&&<p className="dialog-note">Search EXO by product name or SKU.</p>}{loading&&<p role="status">Searching EXO stock items…</p>}{error&&<p role="alert" className="price-warning">{error} <button type="button" className="text-button" onClick={()=>setRetry(v=>v+1)}>Try again</button></p>}
 {result&&<><p className="dialog-note">{result.total.toLocaleString()} EXO matches{result.total>60?' · Showing the first 60; refine your search for more':''}. Sell prices exclude GST.</p><div className="catalogue-list">{result.products.map(item=><button type="button" key={item.sku} disabled={disabled} onClick={()=>onAdd(item)}><div className="product-image small"><Package aria-hidden="true"/></div><span><strong>{item.name}</strong><small>{item.sku} · {item.price===0?'Price required — enter after adding':money(item.price)+' ex GST'} · EXO</small></span><Plus size={19}/></button>)}</div>{result.total===0&&<p>No EXO products match your search.</p>}</>}
 {disabled&&<p>This quote has reached its 50-product limit.</p>}</div>}
 </section>;
}
