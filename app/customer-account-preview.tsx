'use client';
import {useEffect,useState} from 'react';
import {FileText,PackageCheck,ArrowRight,RefreshCw} from 'lucide-react';
import {Tabs,TabsList,TabsTrigger,TabsContent} from '@/components/ui/tabs';
import {money,totals,type Quote} from '@/lib/quote';

type Order={
 public_id:string;
 order_number:string|null;
 quote_id:string;
 quote_number:string;
 total:number;
 payment_status:string;
 status:string;
 created:string;
};

export default function CustomerAccountPreview({quoteId,onOpenQuote}:{quoteId:string;onOpenQuote:(id:string)=>void}){
 const [data,setData]=useState<{customer?:{email:string;company:string;contact:string};quotes:Quote[];orders:Order[]}|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 async function load(){
  setLoading(true);setError('');
  try{const r=await fetch('/api/customer-account/'+encodeURIComponent(quoteId),{cache:'no-store'}),j=await r.json() as any;if(!r.ok)throw Error(j.error||'Customer account preview could not be loaded.');setData(j);}
  catch(e){setError(e instanceof Error?e.message:'Customer account preview could not be loaded.');}
  finally{setLoading(false);}
 }
 useEffect(()=>{void load();},[quoteId]);
 return <section className="card customer-account-preview"><div className="section-heading between"><div><div className="eyebrow dark">CUSTOMER ACCOUNT PREVIEW</div><h2>{data?.customer?.company||data?.customer?.contact||'Customer account'}</h2><p>{data?.customer?.email||'Approved quotations and completed orders will appear here.'}</p></div><button className="btn outline" type="button" onClick={()=>void load()} disabled={loading}><RefreshCw size={15}/>{loading?'Loading…':'Refresh'}</button></div>
 {error&&<p className="price-warning" role="alert">{error}</p>}
 <Tabs defaultValue="quotes"><TabsList><TabsTrigger value="quotes"><FileText size={15}/>Quotes <span>{data?.quotes?.length||0}</span></TabsTrigger><TabsTrigger value="orders"><PackageCheck size={15}/>Orders <span>{data?.orders?.length||0}</span></TabsTrigger></TabsList>
 <TabsContent value="quotes"><div className="customer-account-list">{data?.quotes?.map(q=><button type="button" key={q.id} onClick={()=>onOpenQuote(q.id)}><span><strong>{q.number}</strong><small>{new Date(q.date+'T12:00:00').toLocaleDateString('en-AU')} · {q.status}</small></span><strong>{money(totals(q).total)}</strong><ArrowRight size={16}/></button>)}{!loading&&!data?.quotes?.length&&<p className="no-history">No approved quotations for this customer yet.</p>}</div></TabsContent>
 <TabsContent value="orders"><div className="customer-account-list">{data?.orders?.map(order=><div className="customer-account-order" key={order.public_id}><span><strong>{order.order_number||'Order'}</strong><small>{new Date(order.created).toLocaleDateString('en-AU')} · From {order.quote_number}</small></span><span><strong>{money(order.total)}</strong><small>{order.payment_status} · {order.status}</small></span></div>)}{!loading&&!data?.orders?.length&&<p className="no-history">No completed orders for this customer yet.</p>}</div></TabsContent>
 </Tabs>
 <p className="connection-help">Preview only for staff while customer sign-in is being added. The same Quotes and Orders structure will be used in the customer account.</p>
 </section>;
}
