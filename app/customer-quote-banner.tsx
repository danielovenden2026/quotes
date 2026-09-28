import {BadgeCheck,Heart,ListChecks,ShoppingCart,Truck} from 'lucide-react';
import {dateLabel,type Quote} from '@/lib/quote';
import {deliveryAddress} from '@/lib/delivery-address';

const benefits=[
 {Icon:Truck,label:'Fast, Nationwide Delivery'},
 {Icon:Heart,label:'Trusted Australian Brand'},
 {Icon:ShoppingCart,label:'Extensive Product Range'},
 {Icon:ListChecks,label:'Australian Standards Compliant'},
 {Icon:BadgeCheck,label:'Quality Beyond Compare'},
];

export default function CustomerQuoteBanner({quote,days,pickup}:{quote:Quote;days:number;pickup:boolean}){
 return <section className="customer-quote-banner" aria-label="Your Verdex quotation">
  <div className="quote-banner-header">
   <div className="quote-banner-number"><span>YOUR VERDEX QUOTATION</span><strong>{quote.number}</strong></div>
   <div className="quote-banner-validity"><div><span>QUOTATION VALID FOR</span><small>until {dateLabel(quote.expiry)}</small></div><strong>{days}<small>days</small></strong></div>
  </div>
  <div className="quote-banner-content">
   <div className="quote-banner-copy">
   <h1>Hello{quote.contact?.trim()?' '+quote.contact.trim():''},</h1>
   <p>Please see your quotation below.</p>
   <div className="quote-banner-fields">
    <div className="quote-banner-address"><strong>{quote.company}</strong><span>{pickup?'Pickup from Verdex':'Address: '+(deliveryAddress(quote)||'your nominated address')}</span></div>
    {quote.customerTerms?.trim()&&<div className="quote-banner-customer-terms">
     {quote.customerTerms?.trim()&&<div><span>Customer terms:</span><strong>{quote.customerTerms}</strong></div>}
    </div>}
   </div>
   <div className="quote-banner-prepared"><div className="quote-banner-preparer"><span>Prepared by <strong>{quote.salesperson?.name||'Daniel Ovenden'}</strong></span>{quote.vendorNumber?.trim()&&<span>Vendor Number: <strong>{quote.vendorNumber}</strong></span>}</div><span>Issued {dateLabel(quote.date)}</span></div>
   </div>
   <div className="quote-banner-brand"><img className="quote-banner-logo" src="/verdex-logo.svg" alt="Verdex" width={179} height={72}/><p className="quote-banner-tagline"><strong><em>Equipping Workplaces Since 1985</em></strong></p></div>
  </div>
  <ul className="quote-banner-benefits" aria-label="Why choose Verdex">{benefits.map(({Icon,label})=><li key={label}><Icon size={21} strokeWidth={1.8} aria-hidden="true"/><span>{label}</span></li>)}</ul>
 </section>;
}
