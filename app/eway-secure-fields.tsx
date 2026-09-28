'use client';
import {useEffect,useRef,useState} from 'react';
import {CreditCard,LockKeyhole} from 'lucide-react';

declare global{
 interface Window{
  eWAY?:{
   setupSecureField:(config:Record<string,unknown>,callback:(event:EwaySecureFieldEvent)=>void)=>void;
   saveAllFields:(callback:()=>void,timeout?:number)=>void;
  };
 }
}
type EwaySecureFieldEvent={
 secureFieldCode?:string;
 targetField?:string;
 fieldValid?:boolean;
 valueIsSaved?:boolean;
 valueIsValid?:boolean;
 errors?:unknown;
};
type Props={
 publicApiKey:string;
 disabled?:boolean;
 onRegisterSave:(save:(()=>Promise<string>)|null)=>void;
};
const fieldStyles='box-sizing:border-box;width:100%;height:44px;border:0;background:#fff;color:#173b56;padding:11px 12px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.4;outline:none;';
export default function EwaySecureFields({publicApiKey,disabled=false,onRegisterSave}:Props){
 const token=useRef(''),valid=useRef<Record<string,boolean>>({name:false,card:false,expirytext:false,cvn:false}),saved=useRef<Record<string,boolean>>({name:false,card:false,expirytext:false,cvn:false}),readyRef=useRef(false);
 const [ready,setReady]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
  let cancelled=false;
  token.current='';valid.current={name:false,card:false,expirytext:false,cvn:false};saved.current={name:false,card:false,expirytext:false,cvn:false};readyRef.current=false;setReady(false);setError('');
  const callback=(event:EwaySecureFieldEvent)=>{
   if(cancelled)return;
   const field=event.targetField||'';
   if(field in valid.current){valid.current[field]=event.fieldValid!==false&&event.valueIsValid!==false;if(event.valueIsSaved===true)saved.current[field]=true;}
   if(typeof event.secureFieldCode==='string'&&event.secureFieldCode.length>10)token.current=event.secureFieldCode;
   if(event.fieldValid===false)setError('One of the secure card fields could not be loaded. Refresh the page and try again.');
  };
  const setup=()=>{
   if(cancelled||!window.eWAY)return;
   try{
    for(const [fieldDivId,fieldType] of [
     ['eway-secure-field-card','card'],
     ['eway-secure-field-expiry','expirytext'],
     ['eway-secure-field-cvn','cvn'],
     ['eway-secure-field-name','name'],
    ] as const)window.eWAY.setupSecureField({publicApiKey,fieldDivId,fieldType,styles:fieldStyles,autocomplete:'true'},callback);
    readyRef.current=true;setReady(true);
   }catch{setError('eWAY Secure Fields could not be loaded. Refresh the page and try again.');}
  };
  const existing=document.querySelector<HTMLScriptElement>('script[data-verdex-eway-secure-fields]');
  if(existing){
   if(window.eWAY)setup();else existing.addEventListener('load',setup,{once:true});
  }else{
   const script=document.createElement('script');
   script.src='https://secure.ewaypayments.com/scripts/eWAY.min.js';
   script.async=true;script.dataset.verdexEwaySecureFields='true';
   script.onload=setup;
   script.onerror=()=>!cancelled&&setError('eWAY Secure Fields could not be loaded. Check your connection and try again.');
   document.head.appendChild(script);
  }
  const save=()=>new Promise<string>((resolve,reject)=>{
   if(!window.eWAY||!readyRef.current){reject(new Error('Secure card fields are still loading.'));return;}
   setError('');
   try{
    const started=Date.now();
    const finish=()=>{
     const allValid=Object.values(valid.current).every(Boolean);
     const allSaved=Object.values(saved.current).every(Boolean);
     if(token.current&&allValid&&allSaved){resolve(token.current);return;}
     if(Date.now()-started<1800){setTimeout(finish,75);return;}
     if(!allValid){reject(new Error('Check the card number, expiry, security code and name on card.'));return;}
     reject(new Error('eWAY could not secure the card details. Please try again.'));
    };
    window.eWAY.saveAllFields(()=>finish(),3000);
   }catch{reject(new Error('eWAY could not secure the card details. Please try again.'));}
  });
  onRegisterSave(save);
  return()=>{cancelled=true;onRegisterSave(null);};
 },[publicApiKey,onRegisterSave]);
 return <div className={'eway-secure-fields '+(disabled?'disabled':'')}>
  <div className="eway-card-heading"><span><CreditCard size={19}/>Credit/Debit Card</span><span className="eway-card-brands"><b>AMEX</b><b>MC</b><b>VISA</b></span></div>
  <div className="eway-card-fields" aria-busy={!ready}>
   <div className="eway-secure-field eway-card-number"><span className="eway-field-label">Card number</span><div id="eway-secure-field-card"/><LockKeyhole size={16}/></div>
   <div className="eway-card-row"><div className="eway-secure-field"><span className="eway-field-label">Expiry (MM/YY)</span><div id="eway-secure-field-expiry"/></div><div className="eway-secure-field"><span className="eway-field-label">Security code</span><div id="eway-secure-field-cvn"/></div></div>
   <div className="eway-secure-field"><span className="eway-field-label">Name on card</span><div id="eway-secure-field-name"/></div>
  </div>
  {!ready&&!error&&<p className="eway-secure-status">Loading secure card fields…</p>}
  {error&&<p className="checkout-error" role="alert">{error}</p>}
 </div>;
}