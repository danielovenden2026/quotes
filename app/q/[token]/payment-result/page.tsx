'use client';
import {useEffect,useState} from 'react';
import {CheckCircle2,CircleX,Clock3,RefreshCw,ArrowLeft} from 'lucide-react';
import {money} from '@/lib/quote';

type Result={quoteNumber:string;amount:number;status:string;transactionId:string|null;responseCode:string|null;mode:'sandbox'|'live';orderNumber?:string|null;};

export default function PublicPaymentResult({params}:any){
 const [token,setToken]=useState(''),[result,setResult]=useState<Result|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(true),[cancelled,setCancelled]=useState(false);
 useEffect(()=>{Promise.resolve(params).then((p:any)=>setToken(p.token));},[params]);
 async function check(currentToken=token){
  if(!currentToken)return;setBusy(true);setError('');
  try{
   const id=new URLSearchParams(window.location.search).get('id')||'';
   const r=await fetch('/api/public/quote/'+encodeURIComponent(currentToken)+'/payment-result?id='+encodeURIComponent(id),{method:'POST',cache:'no-store'});
   const data=await r.json() as any;if(!r.ok)throw Error(data.error||'Unable to check payment.');setResult(data);
  }catch(e){setError(e instanceof Error?e.message:'Unable to check payment.');}finally{setBusy(false);}
 }
 useEffect(()=>{if(!token)return;const params=new URLSearchParams(window.location.search);setCancelled(params.get('cancelled')==='1');const id=params.get('id');window.history.replaceState(null,'',window.location.pathname+(id?'?id='+encodeURIComponent(id):''));void check(token);},[token]);
 const live=result?.mode==='live',success=result?.status==='succeeded',declined=result?.status==='declined'||result?.status==='failed';
 const title=busy?'Checking with eWAY…':success?(live?'Payment successful':'Test payment successful'):declined?'Payment not approved':error?'Payment confirmation unavailable':cancelled?'Payment cancelled':'Payment not completed';
 const Icon=success?CheckCircle2:declined?CircleX:Clock3;
 return <main className="payment-result-page"><img src="/verdex-logo.svg" alt="Verdex" width="180"/><section className="payment-result-card"><span className="checkout-eyebrow">{live?'eWAY LIVE':'eWAY SANDBOX'}</span><Icon size={44} className={success?'payment-success-icon':''}/><h1>{title}</h1><p>{success&&live?'Your payment has been confirmed and your Verdex order has been created.':live?'No payment is treated as successful until eWAY confirms the transaction.':'No real money is taken in Sandbox.'}</p>
 {result&&<dl><div><dt>Quote</dt><dd>{result.quoteNumber}</dd></div><div><dt>Amount (AUD)</dt><dd>{money(result.amount)}</dd></div>{result.orderNumber&&<div><dt>Verdex order</dt><dd>{result.orderNumber}</dd></div>}{result.transactionId&&<div><dt>eWAY transaction</dt><dd>{result.transactionId}</dd></div>}</dl>}
 {error&&<p className="checkout-error" role="alert">{error}</p>}<div className="actions">{!success&&!declined&&<button className="btn primary" disabled={busy} onClick={()=>void check()}><RefreshCw size={17}/>Check payment result</button>}<a className="btn outline" href={token?'/q/'+encodeURIComponent(token):'/'}><ArrowLeft size={17}/>Return to quotation</a></div></section></main>;
}
