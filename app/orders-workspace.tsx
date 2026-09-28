'use client';
import {useEffect,useMemo,useState} from 'react';
import {RefreshCw,Search,PackageCheck,ArrowRight} from 'lucide-react';
import {Table,TableHeader,TableHead,TableRow,TableBody,TableCell} from '@/components/ui/table';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import {money} from '@/lib/quote';
const orderStatuses=['New Order','Entered to EXO','Processing','Dispatched','Completed'] as const;
type OrderStatus=typeof orderStatuses[number];
type OrderRecord={public_id:string;order_number:string|null;quote_id:string;quote_number:string;quote_revision:number;customer_email:string;company:string;contact:string;total:number;payment_method:string;payment_status:string;payment_reference:string|null;status:OrderStatus;created:string;updated:string;entered_exo_at:string|null;};
import {toast} from 'sonner';

export default function OrdersWorkspace(){
 const [orders,setOrders]=useState<OrderRecord[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[search,setSearch]=useState('');
 async function load(){setLoading(true);setError('');try{const r=await fetch('/api/orders',{cache:'no-store'}),data=await r.json() as any;if(!r.ok)throw Error(data.error||'Orders could not be loaded.');setOrders(data);}catch(e){setError(e instanceof Error?e.message:'Orders could not be loaded.');}finally{setLoading(false);}}
 useEffect(()=>{void load();},[]);
 async function setStatus(order:OrderRecord,status:OrderStatus){
  try{const r=await fetch('/api/orders/'+encodeURIComponent(order.public_id),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})}),data=await r.json() as any;if(!r.ok)throw Error(data.error||'Order could not be updated.');setOrders(v=>v.map(o=>o.public_id===order.public_id?data:o));toast.success('Order '+(data.order_number||'')+' updated');}catch(e){toast.error(e instanceof Error?e.message:'Order could not be updated.');}
 }
 const results=useMemo(()=>orders.filter(o=>(o.order_number+' '+o.quote_number+' '+o.company+' '+o.contact+' '+o.customer_email).toLowerCase().includes(search.trim().toLowerCase())),[orders,search]);
 return <main className="page-shell quotes-workspace"><div className="quotes-workspace-heading"><div><div className="eyebrow dark">VERDEX ORDERS</div><h1>Orders Workspace</h1><p>Completed quote checkouts ready for EXO processing.</p></div><button className="btn outline" onClick={()=>void load()} disabled={loading}><RefreshCw size={16}/>{loading?'Refreshing…':'Refresh'}</button></div>
 <section className="card quotes-workspace-card"><div className="quotes-workspace-toolbar"><div className="search-box"><Search size={18}/><input aria-label="Search orders" placeholder="Search order, quote or customer" value={search} onChange={e=>setSearch(e.target.value)}/></div></div>
 {error&&<p className="price-warning" role="alert">{error}</p>}
 <Table className="quotes-workspace-table"><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Order #</TableHead><TableHead>Quote #</TableHead><TableHead>Customer</TableHead><TableHead className="quote-amount">Total</TableHead><TableHead>Payment</TableHead><TableHead>Status</TableHead><TableHead/></TableRow></TableHeader><TableBody>
 {results.map(order=><TableRow key={order.public_id}><TableCell>{new Date(order.created).toLocaleDateString('en-AU')}</TableCell><TableCell><strong>{order.order_number||'Creating…'}</strong></TableCell><TableCell>{order.quote_number}</TableCell><TableCell><strong>{order.company||order.contact}</strong><small className="quote-customer">{order.customer_email}</small></TableCell><TableCell className="quote-amount"><strong>{money(order.total)}</strong></TableCell><TableCell>{order.payment_status}<small className="quote-customer">{order.payment_method==='card'?'eWAY card':order.payment_method}</small></TableCell><TableCell><Select value={order.status} onValueChange={v=>void setStatus(order,v as OrderStatus)}><SelectTrigger aria-label={'Status for '+order.order_number}><SelectValue/></SelectTrigger><SelectContent>{orderStatuses.map(status=><SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select>{order.entered_exo_at&&<small className="quote-customer">EXO: {new Date(order.entered_exo_at).toLocaleString('en-AU')}</small>}</TableCell><TableCell className="quote-action"><a className="btn outline" href={'/workspace?id='+encodeURIComponent(order.quote_id)} aria-label={'Open source quote '+order.quote_number}>Quote <ArrowRight size={15}/></a></TableCell></TableRow>)}
 </TableBody></Table>
 {!loading&&!results.length&&<div className="empty-state"><PackageCheck size={30}/><h3>{search?'No matching orders':'No orders yet'}</h3><p>{search?'Try a different search.':'A verified live checkout will create the first order.'}</p></div>}
 <div className="quotes-workspace-count">{loading?'Loading orders…':results.length+' of '+orders.length+' orders'}</div></section></main>;
}
