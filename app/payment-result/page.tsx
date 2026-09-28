'use client';
import {useEffect,useState} from 'react';
import {CheckCircle2,CircleX,Clock3,RefreshCw,ArrowLeft} from 'lucide-react';
import {money} from '@/lib/quote';

type Result={id:string;quoteId:string;quoteNumber:string;quoteVersion:number;quoteChanged:boolean;quoteStatus?:string;amount:number;status:string;transactionId:string|null;responseCode:string|null;mode:'sandbox'|'live';orderNumber?:string|null;orderId?:string|null};

export default function PaymentResult(){
 const [result,setResult]=useState<Result|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(true),[cancelled,setCancelled]=useState(false);
 async function check(){setBusy(true);setError('');try{const id=new URLSearchParams(window.location.search).get('id')||'';const r=await fetch('/api/payments/test-result?id='+encodeURIComponent(id),{method:'POST',cache:'no-store'});const data=await r.json() as any;if(!r.ok)throw Error(data.error||'Unable to check payment.');setResult(data);}catch(e){setError(e instanceof Error?e.message:'Unable to check payment.');}finally{setBusy(false);}}
 useEffect(()=>{const params=new URLSearchParams(window.location.search);setCancelled(params.get('cancelled')==='1');const id=params.get('id');window.history.replaceState(null,'',window.location.pathname+(id?'?id='+encodeURIComponent(id):''));void check();},[]);
 const live=result?.mode==='live',success=result?.status==='succeeded',declined=result?.status==='declined'||result?.status==='failed';
 const title=busy?'Checking with eWAY…':success?(live?'Payment successful':'Test payment successful'):declined?(live?'Payment not approved':'Test payment not approved'):error?'Payment confirmation unavailable':cancelled?'Payment cancelled':'Payment not completed';
 const Icon=success?CheckCircle2:declined?CircleX:Clock3;
 return <main className="payment-result-page"><img src="/verdex-logo.svg" alt="Verdex" width="180"/><section className="payment-result-card"><span className="checkout-eyebrow">{live?'eWAY LIVE':'eWAY SANDBOX'}</span><Icon size={44} className={success?'payment-success-icon':''}/><h1>{title}</h1><p>{live?(success?'Your card payment has been verified by eWAY. Your quotation has been accepted and a Verdex order has been created.':'This is a live payment. No payment is treated as successful until eWAY confirms the transaction.'):'No real money is taken in Sandbox. A test payment does not mark your quote paid or place an order.'}</p>
 {result&&<dl><div><dt>Quote</dt><dd>{result.quoteNumber}</dd></div><div><dt>{live?'Amount paid (AUD)':'Test amount (AUD)'}</dt><dd>{money(result.amount)}</dd></div>{result.orderNumber&&<div><dt>Verdex order</dt><dd>{result.orderNumber}</dd></div>}{result.transactionId&&<div><dt>eWAY transaction</dt><dd>{result.transactionId}</dd></div>}{result.responseCode&&<div><dt>Response code</dt><dd>{result.responseCode}</dd></div>}</dl>}
 {result?.quoteChanged&&<p>This payment relates to an earlier saved version of the quote. Review the quote before continuing.</p>}{declined&&<p>{live?'The card payment was not approved. Return to checkout to try again or choose another payment method.':'You can return to checkout, save the details and start a new test. Sandbox response settings may simulate a decline.'}</p>}{error&&<p role="alert" className="checkout-error">{error}</p>}
 <div className="actions">{!success&&!declined&&<button className="btn primary" disabled={busy} onClick={()=>void check()}><RefreshCw size={17}/>Check payment result</button>}<a className="btn outline" href={result?'/quote/'+encodeURIComponent(result.quoteId)+'#checkout':'/workspace'}><ArrowLeft size={17}/>{result?'Return to quote':'Sales workspace'}</a></div>
 </section></main>;
}
