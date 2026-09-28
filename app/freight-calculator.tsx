'use client';
import {useEffect,useRef,useState} from 'react';
import {Truck,AlertTriangle} from 'lucide-react';
import {createPortal} from 'react-dom';
import {type Quote,money} from '@/lib/quote';
import {freightInput,freightFingerprint,freightNeedsRefresh,type FreightRate,type FreightEstimate} from '@/lib/freight';
import {FreightDiagnostics} from './magento-freight-connection';
export default function FreightCalculator({quote,disabled,onApply,onManual,toolbarTarget,feedbackTarget}:{quote:Quote;disabled:boolean;onApply:(rate:number,estimate:FreightEstimate)=>void;onManual:()=>void;toolbarTarget?:HTMLElement|null;feedbackTarget?:HTMLElement|null}){
 const fingerprint=freightFingerprint(quote),latest=useRef(fingerprint);latest.current=fingerprint;
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[diagnostics,setDiagnostics]=useState<any>(),[result,setResult]=useState<{fingerprint:string;rates:FreightRate[];at:string}|null>(null);
 const baseline=useRef(fingerprint),[showTop,setShowTop]=useState(false);
 const controller=useRef<AbortController|null>(null);useEffect(()=>()=>controller.current?.abort(),[]);
 async function calculate(){if(busy||disabled)return;setBusy(true);setError('');setDiagnostics(undefined);setResult(null);const signal=new AbortController();controller.current=signal;try{const r=await fetch('/api/admin/magento-freight',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'estimate',shipment:freightInput(quote)}),signal:signal.signal,cache:'no-store'}),data:any=await r.json();if(signal.signal.aborted)return;if(latest.current!==fingerprint){setError('The shipment changed during calculation. Calculate freight again.');return;}if(!r.ok){setDiagnostics(data.diagnostics);throw Error(data.error||'Freight could not be calculated.');}setResult({fingerprint,rates:data.rates,at:data.calculatedAt});}catch(e){if(!signal.signal.aborted)setError(e instanceof Error?e.message:'Freight could not be calculated.');}finally{if(!signal.signal.aborted)setBusy(false);}}
 const stale=freightNeedsRefresh(quote),input=freightInput(quote),custom=input.items.some(i=>i.custom);
 const needsCalculation=stale||(!quote.freightEstimate&&baseline.current!==fingerprint);
 const warning=needsCalculation?<p className="staff-freight-warning" role="alert"><AlertTriangle size={18} aria-hidden="true"/><span>The shipment has changed. Calculate freight and apply a rate before saving the quote.{custom?' Ad hoc products require a manual freight amount.':''}</span></p>:null;
 function calculateButton(top=false){return <button type="button" className={'btn '+(needsCalculation?'freight-recalculate':'outline')} disabled={disabled||busy||custom||!input.items.length||!quote.state||!/^\d{4}$/.test(quote.postcode||'')} onClick={()=>{setShowTop(top);void calculate();}}><Truck size={16}/>{busy?'Calculating freight…':'Calculate freight'}</button>;}
 const feedback=<>{error&&<p className="connection-feedback error" role="alert">{error}</p>}<FreightDiagnostics value={diagnostics}/>{result&&result.fingerprint===fingerprint&&<div className="freight-options" aria-label="Magento delivery options">{result.rates.map((rate,index)=><div key={rate.carrierCode+rate.methodCode+index}><span><strong>{rate.label}</strong><small>{money(rate.amount)} ex GST</small></span><button type="button" className="btn primary" disabled={disabled||busy} onClick={()=>{baseline.current=fingerprint;onApply(rate.amount,{...rate,fingerprint,calculatedAt:result.at});setResult(null);}}>Use this rate</button></div>)}</div>}</>;
 return <>
 {toolbarTarget&&createPortal(calculateButton(true),toolbarTarget)}
 {feedbackTarget&&createPortal(<>{warning}{showTop&&feedback}</>,feedbackTarget)}
 <div className="freight-calculator"><div className="actions">{calculateButton()}{(quote.freightEstimate||needsCalculation)&&<button type="button" className="text-button" disabled={disabled||busy} onClick={()=>{baseline.current=fingerprint;onManual();}}>Confirm entered freight manually</button>}</div>
 <p className="connection-help">One shipment to the quote address. Uses Magento’s current product data and cart rules. Site handling remains a separate charge.</p>
 {custom&&<p className="price-warning">Ad hoc products need manual freight for the complete shipment.</p>}
 {!quote.state||!/^\d{4}$/.test(quote.postcode||'')?<p className="connection-help">Enter a state and four-digit postcode to calculate freight.</p>:null}
 {warning||quote.freightEstimate&&<p className="connection-help">{quote.freightEstimate.label} · {money(quote.freightEstimate.amount)} ex GST · Calculated {new Date(quote.freightEstimate.calculatedAt).toLocaleString('en-AU')}</p>}
 {!showTop&&feedback}
 </div></>;
}
