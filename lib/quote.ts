import {netUnitPrice,lineSubtotal,type LineDiscount} from './line-pricing';
import type {FreightEstimate} from './freight';
import type {QuoteBlock} from './quote-layout';
import {fulfilmentCharges,type FulfilmentMethod} from './fulfilment';
// Legacy quotes use their unique SKU as the row key; newly added lines receive a UUID.
export const lineKey=(item:{lineId?:string;sku:string})=>item.lineId||item.sku;
export type Item={discount?:LineDiscount;productSource?:'exo';exoDescriptionHtml?:string;noAutoOptions?:boolean;autoOptionFor?:string;autoOptionSource?:'related'|'otherskus';demoCostLineId?:string;lineId?:string;demoCost?:number;sourceSku?:string;adhocId?:string;sku:string;name:string;price:number;standardPrice?:number;qty:number;baseQty:number;optional:boolean;selected:boolean;note:string;image?:string;images?:string[];custom?:boolean;url?:string};
export type Quote={checkout?:import('./checkout').CheckoutDetails;salesperson?:{name:string;email:string;phone:string};freightEstimate?:FreightEstimate|null;hubspotContactId?:string;hubspotCompanyId?:string;id:string;number:string;company:string;contact:string;email:string;address:string;suburb?:string;state?:string;postcode?:string;title:string;reference:string;vendorNumber?:string;customerTerms?:string;date:string;expiry:string;freight:number;handling:number;fulfilmentMethod?:FulfilmentMethod;hidePickup?:boolean;hideOwnFreight?:boolean;ownFreightNotes?:string;deliveryNotes?:string;terms:string;status:string;revision:number;version:number;items:Item[];blocks?:QuoteBlock[];po:string;instructions:string;events:{at:string;text:string}[];snapshots:any[];acceptedBy?:string;acceptedAt?:string;payment?:string};
export const money=(c:number)=>new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(c/100);
export const totals=(q:Quote)=>{const items=q.items.filter(i=>!i.optional||i.selected).reduce((s,i)=>s+lineSubtotal(i),0);const subtotal=items+fulfilmentCharges(q).total;const gst=Math.round(subtotal/10);return {items,subtotal,gst,total:subtotal+gst};};
export const dateLabel=(s:string)=>new Date(s+'T12:00:00').toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'});
const url='https://www.verdex.com.au/forklift-safety-cage-work-platform';
export const catalogue:Item[]=[
{sku:'V4000',name:'Forklift Safety Cage / Work Platform',price:108000,qty:1,baseQty:1,optional:false,selected:true,note:'',image:'https://www.verdex.com.au/media/catalog/product/cache/5ea2c937db12cf800bc1db1f243f6608/v/4/v4000p_1.jpg',url},
{sku:'V4070',name:'Cage Storage Stand',price:16500,qty:1,baseQty:1,optional:false,selected:true,note:''},
{sku:'V4002',name:'Full Body Safety Harness',price:26500,qty:1,baseQty:1,optional:true,selected:false,note:'',image:'https://www.verdex.com.au/media/image_resizer/cache/39144d0d67991ed7eb615d815960c9ca/catalog/product/v/4/v4002_1.jpg',url:'https://www.verdex.com.au/full-body-safety-harness'},
{sku:'V4000A',name:'Cage Assembly (pre-delivery)',price:9500,qty:1,baseQty:1,optional:true,selected:false,note:'',image:'https://www.verdex.com.au/media/image_resizer/cache/39144d0d67991ed7eb615d815960c9ca/catalog/product/v/4/v4000a_1.jpg',url},
{sku:'DEMO-LANYARD',name:'Twin-leg Lanyard 1.8m',price:8900,qty:1,baseQty:1,optional:true,selected:false,note:''},
{sku:'DEMO-PINS',name:'Tyne Pocket Locking Pins',price:4500,qty:1,baseQty:1,optional:true,selected:false,note:''},
];
export function newQuote(demo=false,id?:string):Quote {const date=new Date().toISOString().slice(0,10);const expiry=new Date(Date.now()+30*864e5).toISOString().slice(0,10);return {id:id||crypto.randomUUID(),number:'',company:demo?'ABC Company Pty Ltd':'',contact:demo?'Alex Smith':'',email:demo?'alex@example.com':'',address:demo?'1 Smith Street':'',suburb:demo?'Parramatta':'',state:demo?'NSW':'',postcode:demo?'2150':'',title:'Forklift Safety Cage',reference:demo?'ABC1234':'',vendorNumber:'',customerTerms:'',date,expiry,fulfilmentMethod:'delivery',hidePickup:true,hideOwnFreight:true,ownFreightNotes:'',deliveryNotes:'',freight:demo?8726:0,handling:demo?2500:0,terms:'Prices in AUD. Item prices exclude GST. Customers may increase quantities. Quantity reductions require approval only for items quoted below their standard price. This is a test quote; no payment or order is created.',status:demo?'Ready':'Draft',revision:1,version:1,items:demo?catalogue.map(i=>({...structuredClone(i),standardPrice:i.price})):[],po:'',instructions:'',events:[],snapshots:[]};}
export const needsReview=(q:Quote)=>q.items.some(i=>!i.optional&&i.qty<i.baseQty&&netUnitPrice(i)<(i.standardPrice??i.price));
export const expired=(q:Quote)=>new Date(q.expiry+'T23:59:59+10:00').getTime()<Date.now();

export const needsPrice=(item:Pick<Item,"price"|"discount">)=>!Number.isSafeInteger(item.price)||netUnitPrice(item)<=0;
