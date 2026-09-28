'use client';
import {useEffect,useState} from 'react';
import {Copy,Link2,RefreshCw,Unlink} from 'lucide-react';
import {toast} from 'sonner';

export default function CustomerShareLink({quoteId,status}:{quoteId:string;status:string}){
 const [token,setToken]=useState<string|null>(null),[loading,setLoading]=useState(false);
 const available=['Ready','Accepted'].includes(status);
 useEffect(()=>{if(!available){setToken(null);return;}const controller=new AbortController();fetch('/api/quotes/'+quoteId+'/share',{cache:'no-store',signal:controller.signal}).then(async r=>{const d=await r.json() as any;if(r.ok)setToken(d.token||null);}).catch(()=>{});return()=>controller.abort();},[quoteId,status,available]);
 const link=token&&typeof window!=='undefined'?window.location.origin+'/q/'+token:'';
 async function create(){
  setLoading(true);try{const r=await fetch('/api/quotes/'+quoteId+'/share',{method:'POST'}),d=await r.json() as any;if(!r.ok)throw Error(d.error||'Link could not be created.');setToken(d.token);const value=window.location.origin+'/q/'+d.token;await navigator.clipboard.writeText(value);toast.success('Customer link created and copied');}catch(e){toast.error(e instanceof Error?e.message:'Customer link could not be created.');}finally{setLoading(false);}
 }
 async function copy(){if(!link)return;try{await navigator.clipboard.writeText(link);toast.success('Customer link copied');}catch{toast.error('Copy the customer link manually.');}}
 async function revoke(){
  setLoading(true);try{const r=await fetch('/api/quotes/'+quoteId+'/share',{method:'DELETE'}),d=await r.json() as any;if(!r.ok)throw Error(d.error||'Link could not be revoked.');setToken(null);toast.success('Customer link revoked');}catch(e){toast.error(e instanceof Error?e.message:'Customer link could not be revoked.');}finally{setLoading(false);}
 }
 if(!available)return <p className="test-note">Approve this quote to create a customer viewing link.</p>;
 return <div className="customer-share-link"><strong><Link2 size={16}/>Customer quote link</strong>{token?<><input aria-label="Customer quote link" readOnly value={link}/><div className="actions"><button className="btn outline" type="button" disabled={loading} onClick={()=>void copy()}><Copy size={15}/>Copy link</button><button className="btn outline" type="button" disabled={loading} onClick={()=>void revoke()}><Unlink size={15}/>Revoke</button></div></>:<button className="btn outline full" type="button" disabled={loading} onClick={()=>void create()}><RefreshCw size={15}/>{loading?'Creating…':'Create & copy customer link'}</button>}</div>;
}
