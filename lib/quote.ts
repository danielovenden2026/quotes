export type Item={sku:string;name:string;price:number;standardPrice?:number;qty:number;baseQty:number;optional:boolean;selected:boolean;note:string;image?:string;url?:string};
export type Quote={id:string;number:string;company:string;contact:string;email:string;address:string;title:string;reference:string;date:string;expiry:string;freight:number;handling:number;terms:string;status:string;revision:number;version:number;items:Item[];po:string;instructions:string;events:{at:string;text:string}[];snapshots:any[];acceptedBy?:string;acceptedAt?:string;payment?:string};
export const money=(c:number)=>new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(c/100);
export const totals=(q:Quote)=>{const items=q.items.filter(i=>!i.optional||i.selected).reduce((s,i)=>s+i.price*i.qty,0);const subtotal=items+q.freight+q.handling;const gst=Math.round(subtotal/10);return {items,subtotal,gst,total:subtotal+gst};};
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
export function newQuote(demo=false,id?:string):Quote {const date=new Date().toISOString().slice(0,10);const expiry=new Date(Date.now()+30*864e5).toISOString().slice(0,10);return {id:id||crypto.randomUUID(),number:'',company:demo?'ABC Company Pty Ltd':'',contact:demo?'Alex Smith':'',email:demo?'alex@example.com':'',address:demo?'1 Smith Street, Parramatta NSW 2150':'',title:'Forklift Safety Cage',reference:demo?'ABC1234':'',date,expiry,freight:8726,handling:2500,terms:'Prices in AUD. Item prices exclude GST. Customers may increase quantities. Quantity reductions require approval only for items quoted below their standard price. This is a test quote; no payment or order is created.',status:demo?'Ready':'Draft',revision:1,version:1,items:demo?catalogue.map(i=>({...structuredClone(i),standardPrice:i.price})):[],po:'',instructions:'',events:[],snapshots:[]};}
export const needsReview=(q:Quote)=>q.items.some(i=>!i.optional&&i.qty<i.baseQty&&i.price<(i.standardPrice??i.price));
export const expired=(q:Quote)=>new Date(q.expiry+'T23:59:59+10:00').getTime()<Date.now();

export const needsPrice=(item:Pick<Item,"price">)=>!Number.isSafeInteger(item.price)||item.price<=0;
