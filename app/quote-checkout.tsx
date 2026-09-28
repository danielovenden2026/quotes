'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {ArrowLeft,Building2,Home,Truck,Package,Forklift,CreditCard,LockKeyhole,CheckCircle2,RefreshCw} from 'lucide-react';
import {Checkbox} from '@/components/ui/checkbox';
import {RadioGroup,RadioGroupItem} from '@/components/ui/radio-group';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import {australianStates,stateNames} from '@/lib/delivery-address';
import {initialCheckout,checkoutSchema,checkoutShipment,type CheckoutAddress,type CheckoutDetails} from '@/lib/checkout';
import {type Quote,totals,money,lineKey,expired} from '@/lib/quote';
import {freightNeedsRefresh} from '@/lib/freight';
import {fulfilmentCharges} from '@/lib/fulfilment';
import {lineSubtotal,discountLabel,hasDiscount,netUnitPrice} from '@/lib/line-pricing';
import EwaySecureFields from './eway-secure-fields';

function AddressFields({value,onChange,prefix}:{value:CheckoutAddress;onChange:(value:CheckoutAddress)=>void;prefix:string}){
 const patch=(field:keyof CheckoutAddress,v:string)=>onChange({...value,[field]:v});
 const field=(name:keyof CheckoutAddress,label:string,required=true,autoComplete?:string)=> <label className="field"><span>{label}{required?' *':''}</span><input required={required} autoComplete={autoComplete?prefix+' '+autoComplete:undefined} value={value[name]} maxLength={name==='phone'?40:name==='postcode'?4:200} inputMode={name==='postcode'?'numeric':name==='phone'?'tel':undefined} type={name==='phone'?'tel':'text'} onChange={e=>patch(name,e.target.value)}/></label>;
 return <div className="checkout-address-grid">
 {field('firstName','First name',true,'given-name')}{field('lastName','Last name',true,'family-name')}
 <div className="checkout-span">{field('company','Company name',false,'organization')}</div>
 <label className="field checkout-span"><span>Country *</span><select value="AU" aria-label="Country"><option value="AU">Australia</option></select></label>
 <div className="checkout-span">{field('street1','Street address',true,'address-line1')}</div>
 <div className="checkout-span">{field('street2','Address line 2',false,'address-line2')}</div>
 <label className="field checkout-span"><span>State / Province *</span><Select value={value.state} onValueChange={v=>patch('state',v)}><SelectTrigger aria-label={prefix+' state'}><SelectValue placeholder="Select state or territory"/></SelectTrigger><SelectContent>{australianStates.map(state=><SelectItem key={state} value={state}>{stateNames[state]}</SelectItem>)}</SelectContent></Select></label>
 {field('city','City / Suburb',true,'address-level2')}{field('postcode','Postcode',true,'postal-code')}
 <div className="checkout-span">{field('phone','Phone number',true,'tel')}</div>
 </div>;
}
const methods=[['invoice','Email me an invoice'],['eft','Bank transfer (EFT)'],['paypal','PayPal'],['account','Pay with company account'],['card','Credit / debit card']] as const;
export default function QuoteCheckout({quote,busy,demo,onBack,onSave,publicToken}:{quote:Quote;busy:boolean;demo:boolean;onBack:()=>void;onSave:(details:CheckoutDetails,refresh:boolean)=>Promise<Quote|null>;publicToken?:string}){
 const [details,setDetails]=useState(()=>initialCheckout(quote)),[error,setError]=useState(''),[savedMessage,setSavedMessage]=useState('');const id=useId();
 const [paying,setPaying]=useState(false),[gateway,setGateway]=useState<{configured:boolean;mode:'sandbox'|'live';paymentsEnabled:boolean;testPaymentsEnabled:boolean;secureFieldsReady?:boolean;publicApiKey?:string|null}|null>(null),[gatewayError,setGatewayError]=useState('');
 const paymentLock=useRef(false),secureFieldsSave=useRef<(()=>Promise<string>)|null>(null);
 const gatewayUrl=publicToken?'/api/public/quote/'+encodeURIComponent(publicToken)+'/eway':'/api/quotes/'+quote.id+'/eway';
 useEffect(()=>{if(demo)return;const controller=new AbortController();fetch(gatewayUrl,{cache:'no-store',signal:controller.signal}).then(async r=>{const data=await r.json() as any;if(!r.ok)throw Error(data.error);setGateway(data);}).catch(e=>{if(!controller.signal.aborted)setGatewayError(e.message||'eWAY status could not be loaded.');});return()=>controller.abort();},[demo,quote.id,gatewayUrl]);
 async function pay(){
  if(paymentLock.current||busy)return;paymentLock.current=true;setPaying(true);setError('');
  try{
   const result=checkoutSchema.safeParse(details);if(!result.success)throw Error(result.error.issues[0]?.message||'Complete the required fields.');
   if(details.paymentMethod!=='card')throw Error('Select Credit / debit card first.');
   if(!gateway?.secureFieldsReady||!gateway.publicApiKey)throw Error('eWAY Secure Fields is not configured yet.');
   if(!secureFieldsSave.current)throw Error('Secure card fields are still loading.');
   const next=JSON.stringify(result.data)===JSON.stringify(quote.checkout)?quote:await onSave(result.data,false);
   if(!next)return;
   const securedCardData=await secureFieldsSave.current();
   const r=await fetch(gatewayUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:next.version,securedCardData})});const data=await r.json() as any;if(!r.ok)throw Error(data.error||'Unable to process payment.');
   window.location.assign(data.resultUrl);
  }catch(e){setError(e instanceof Error?e.message:'Unable to process payment.');}finally{paymentLock.current=false;setPaying(false);}
 }
 const locked=busy||paying;
 const patch=(p:Partial<CheckoutDetails>)=>{setDetails(v=>({...v,...p}));setSavedMessage('');setError('');};
 const preview=checkoutShipment(quote,details),t=totals(preview),charges=fulfilmentCharges(preview),stale=freightNeedsRefresh(preview),available=quote.status==='Ready'&&!expired(quote);
 async function save(refresh=false){
  setError('');setSavedMessage('');const result=checkoutSchema.safeParse(details);
  if(!result.success){setError(result.error.issues[0]?.message||'Please check the required fields.');return;}
  const next=await onSave(result.data,refresh);
  if(next){setSavedMessage(next.status!=='Ready'?'Your changes need sales approval. Return to your quote for the next step.':refresh?'Details saved and delivery freight refreshed.':demo?'Checkout details saved for this demo session. No order or payment has been created.':'Checkout details saved. No order or payment has been created.');}
 }
 return <div className="checkout-page">
 <header className="checkout-header"><img src="/verdex-logo.svg" alt="Verdex" width="170" height="64"/><button className="btn outline" type="button" disabled={locked} onClick={onBack}><ArrowLeft size={17}/>Back to quote</button></header>
 <main className="checkout-main"><div className="checkout-heading"><div><span className="checkout-eyebrow">QUOTATION {quote.number}</span><h1>Checkout</h1></div><span className="checkout-test">{demo?'Demo checkout · payments unavailable':gateway?.mode==='live'?'eWAY Live · Secure payment':gateway?.mode==='sandbox'?'eWAY Sandbox · Test payments only':'eWAY payment connection'}</span></div>
 <form className="checkout-layout" onSubmit={e=>{e.preventDefault();void save();}}>
 <fieldset disabled={locked||!available} className="checkout-form-fields">
 <section className="checkout-section"><h2><span>1</span>Contact details</h2><label className="field"><span>Email address *</span><input type="email" required autoComplete="email" maxLength={254} value={details.email} onChange={e=>patch({email:e.target.value})}/></label></section>
 <section className="checkout-section"><h2><span>2</span>Billing address</h2>
 <RadioGroup aria-label="Address type" className="checkout-choice-grid" value={details.billing.addressType} onValueChange={v=>patch({billing:{...details.billing,addressType:v as 'business'|'home'}})}>{[{value:'business',label:'Business address',Icon:Building2},{value:'home',label:'Home address',Icon:Home}].map(({value,label,Icon})=><label className={'checkout-choice '+(details.billing.addressType===value?'selected':'')} key={value} htmlFor={id+value}><RadioGroupItem value={value} id={id+value}/><span>{label}</span><Icon size={20}/></label>)}</RadioGroup>
 <AddressFields value={details.billing} onChange={billing=>patch({billing})} prefix="billing"/>
 </section>
 <section className="checkout-section"><h2><span>3</span>Delivery</h2>
 <RadioGroup aria-label="Delivery type" className="checkout-choice-grid" value={details.fulfilmentMethod} onValueChange={v=>patch({fulfilmentMethod:v as CheckoutDetails['fulfilmentMethod']})}>
 {([{value:'delivery',label:'Delivery',Icon:Truck},{value:'pickup',label:'Pickup',Icon:Package},{value:'own-freight',label:'Own Freight',Icon:Truck}] as const).filter(v=>!(v.value==='pickup'&&quote.hidePickup)&&!(v.value==='own-freight'&&quote.hideOwnFreight)).map(({value,label,Icon})=><label className={'checkout-choice '+(details.fulfilmentMethod===value?'selected':'')} htmlFor={id+value} key={value}><RadioGroupItem value={value} id={id+value}/><span>{label}</span><Icon size={20}/></label>)}
 </RadioGroup>
 {details.fulfilmentMethod!=='pickup'&&<><label className="check-label checkout-same"><Checkbox checked={details.sameAddress} onCheckedChange={v=>patch({sameAddress:v===true})}/>Shipping address is the same as billing address</label>{!details.sameAddress&&<div className="checkout-shipping-address"><h3>Shipping address</h3><AddressFields value={details.shipping} onChange={shipping=>patch({shipping})} prefix="shipping"/></div>}</>}
 {details.fulfilmentMethod==='delivery'&&<><h3>Delivery details</h3><RadioGroup aria-label="Unloading method" className="checkout-choice-grid" value={details.hasForklift?'forklift':'hand'} onValueChange={v=>patch({hasForklift:v==='forklift'})}><label className={'checkout-choice '+(details.hasForklift?'selected':'')} htmlFor={id+'forklift'}><RadioGroupItem id={id+'forklift'} value="forklift"/><span>Forklift unload</span><Forklift size={23}/></label><label className={'checkout-choice '+(!details.hasForklift?'selected':'')} htmlFor={id+'hand'}><RadioGroupItem id={id+'hand'} value="hand"/><span>No forklift<small>Hand unload · $25.00 ex GST</small></span><Truck size={23}/></label></RadioGroup></>}
 <h3>Shipping method</h3><div className={'checkout-shipping-rate '+(stale?'needs-refresh':'')}><Truck size={23}/><div><strong>{stale?'Refresh delivery freight':charges.method==='Delivery'?(quote.freightEstimate?.label||'Quoted delivery'):charges.method}</strong><p>{stale?'The delivery address has changed. Calculate the current freight cost.':details.fulfilmentMethod==='pickup'?'Collect from Verdex.':details.fulfilmentMethod==='own-freight'?'Arrange collection with your own carrier.':'Delivery and unloading charges are included in your order summary.'}</p></div>{!stale&&<strong>{money(charges.total)}<small>ex GST</small></strong>}</div>
 {details.fulfilmentMethod==='delivery'&&<button type="button" className={'btn '+(stale?'danger':'outline')} onClick={()=>void save(true)}><RefreshCw size={17}/>{busy?'Calculating…':'Refresh freight cost'}</button>}
 </section>
 <section className="checkout-section"><h2><span>4</span>Payment method</h2><RadioGroup aria-label="Payment method" className="checkout-payment-options" value={details.paymentMethod} onValueChange={v=>patch({paymentMethod:v as CheckoutDetails['paymentMethod']})}>{methods.map(([value,label])=><label htmlFor={id+value} className={'checkout-payment-choice '+(details.paymentMethod===value?'selected':'')} key={value}><RadioGroupItem value={value} id={id+value}/><span>{label}</span>{value==='card'&&<CreditCard size={22}/>}</label>)}</RadioGroup>
 <div className="checkout-payment-info"><LockKeyhole size={21}/><p>{details.paymentMethod==='card'?'Enter your card details below. The card fields are securely hosted by eWAY inside this checkout page; Verdex does not receive or store the raw card number or CVV.':details.paymentMethod==='account'?'Company account orders are subject to account approval and agreed payment terms.':details.paymentMethod==='paypal'?'PayPal is shown to match your website checkout. PayPal payments are not connected.':details.paymentMethod==='invoice'?'Your invoice preference will be saved. Invoice emails are not sent in this preview.':'Your bank transfer preference will be saved. No payment or order is created in this preview.'}</p></div>
 {details.paymentMethod==='card'&&<div className="checkout-card-test">
 <strong>{gateway?.mode==='live'?'Secure card payment · Live':'Secure card payment · Sandbox'}</strong>
 <p>{gateway?.mode==='live'?'Your card will be processed securely by eWAY without leaving this checkout page.':'Sandbox mode only. No real money is taken.'}</p>
 {demo?<p className="checkout-error">Open an approved customer quotation to use eWAY. Demo quotations cannot start payments.</p>:gatewayError?<p className="checkout-error">{gatewayError}</p>:!gateway?<p>Checking eWAY connection…</p>:!gateway.configured?<p className="checkout-error">Connect eWAY in Workspace Connections.</p>:!gateway.secureFieldsReady||!gateway.publicApiKey?<p className="checkout-error">Reconnect eWAY in Workspace Connections and add the Public API Key to enable embedded card fields.</p>:<><EwaySecureFields publicApiKey={gateway.publicApiKey} disabled={locked||stale||!available} onRegisterSave={save=>{secureFieldsSave.current=save;}}/>{gateway.mode==='sandbox'&&<p className="checkout-test-card">Test Visa: <strong>4444 3333 2222 1111</strong><br/>Name: Eway Test · Expiry: any future date · CVV: 123</p>}<button type="button" className="btn primary" disabled={locked||stale||!available||!(gateway.paymentsEnabled||gateway.testPaymentsEnabled)} onClick={()=>void pay()}><CreditCard size={18}/>{paying?'Processing payment…':gateway.mode==='live'?'Pay securely now':'Process secure test payment'}</button></>}
 </div>}
 </section>
 </fieldset>
 <aside className="checkout-summary"><section className="checkout-summary-card"><h2>Order summary</h2><span className="checkout-summary-ref">{quote.number}</span>
 <div className="checkout-items">{quote.items.filter(i=>(!i.optional||i.selected)&&i.qty>0).map(i=><article className="checkout-item" key={lineKey(i)}><div className="checkout-thumb">{i.image?<img src={i.image} alt="" onError={e=>{e.currentTarget.style.display='none';}}/>:<Package size={26}/>}</div><div><strong>{i.name}</strong><small>SKU {i.sku}</small><span>{i.qty} × {money(netUnitPrice(i))} <small>ex GST</small></span>{hasDiscount(i)&&<small className="checkout-discount"><s>{money(i.price)}</s> · {discountLabel(i)}</small>}</div><b>{money(lineSubtotal(i))}</b></article>)}</div>
 <fieldset disabled={locked||!available} className="checkout-summary-fields">
 <details open><summary>Order comment</summary><label className="field"><span>Order comment (optional)</span><textarea rows={3} maxLength={2000} value={details.orderComment} onChange={e=>patch({orderComment:e.target.value})}/></label></details>
 <details open={!!details.purchaseOrder||undefined}><summary>Purchase order number</summary><label className="field"><span>Purchase order number (optional)</span><input maxLength={200} value={details.purchaseOrder} onChange={e=>patch({purchaseOrder:e.target.value})}/></label></details></fieldset>
 <dl className="checkout-totals"><div><dt>Subtotal</dt><dd>{money(t.items)}</dd></div><div><dt>{charges.method==='Delivery'?'Delivery freight':charges.method}</dt><dd>{stale?'Recalculate':money(charges.method==='Delivery'?preview.freight:charges.total)}</dd></div>{details.fulfilmentMethod==='delivery'&&<div><dt>Site handling</dt><dd>{money(preview.handling)}</dd></div>}<div><dt>GST (10%)</dt><dd>{stale?'Pending':money(t.gst)}</dd></div><div className="checkout-grand"><dt>Grand total<small>including GST</small></dt><dd>{stale?'Pending':money(t.total)}</dd></div></dl><p className="checkout-currency">All amounts in AUD</p>
 {error&&<p className="checkout-error" role="alert">{error}</p>}{savedMessage&&<p className="checkout-saved" role="status"><CheckCircle2 size={18}/>{savedMessage}</p>}
 {!available&&<p className="checkout-error" role="alert">This quote is {quote.status.toLowerCase()}{expired(quote)?' or expired':''}. Return to the quote for sales approval.</p>}
 <button type="submit" className="btn primary full" disabled={locked||!available}>{busy?'Saving…':'Save checkout details'}</button><button type="button" className="btn primary full" disabled={locked||!available||stale||demo||!(gateway?.paymentsEnabled||gateway?.testPaymentsEnabled)||details.paymentMethod!=='card'||!gateway?.secureFieldsReady} onClick={()=>void pay()}>{paying?'Processing payment…':gateway?.mode==='live'?'Pay securely now':'Process secure test payment'} <LockKeyhole size={16}/></button><p className="checkout-help">{gateway?.mode==='live'?'Live card payments are processed securely by eWAY Secure Fields without leaving this checkout page. Successful payment creates a Verdex order for EXO processing.':'Sandbox card payments only. No money is taken. Other payment methods are saved as preferences.'}</p>
 </section><p className="checkout-terms">Quotation subject to Verdex’s terms and conditions.</p></aside>
 </form></main></div>;
}
