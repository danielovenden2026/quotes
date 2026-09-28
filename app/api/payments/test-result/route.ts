import {requirePermission,readQuote} from '@/lib/workspace-access';
import {privateHeaders} from '@/lib/admin-access';
import {EwayError} from '@/lib/eway';
import {readEwayPayment,verifyEwayPayment} from '@/lib/eway-payment';
import {db} from '@/lib/store';
import type {Quote} from '@/lib/quote';
import {createOrderFromQuote} from '@/lib/orders';

const json=(data:unknown,status=200)=>Response.json(data,{status,headers:privateHeaders});

async function markLivePaymentAccepted(payment:NonNullable<Awaited<ReturnType<typeof readEwayPayment>>>,record:{quote:Quote;owner:string},transactionId:string|null){
 const q=structuredClone(record.quote);
 if(q.status==='Accepted')return q;
 if(q.version!==payment.quote_version||q.status!=='Ready')return q;
 const at=new Date().toISOString();
 const payer=[q.checkout?.billing?.firstName,q.checkout?.billing?.lastName].filter(Boolean).join(' ').trim()||q.contact||'Customer';
 q.status='Accepted';
 q.acceptedAt=at;
 q.acceptedBy=payer;
 q.payment='card';
 q.events.push({at,text:'Live eWAY card payment confirmed'+(transactionId?' · Transaction '+transactionId:'')});
 q.version++;
 const updated=await db().prepare('UPDATE quotes SET data=?,version=?,updated=? WHERE id=? AND owner=? AND version=?').bind(JSON.stringify(q),q.version,at,q.id,record.owner,payment.quote_version).run();
 return updated.meta.changes?q:record.quote;
}

export async function POST(r:Request){
 if(r.headers.get('origin')!==new URL(r.url).origin)return json({error:'Request origin is not allowed.'},403);
 let user;try{user=await requirePermission(r,'sendQuotes');}catch{return json({error:'Sign in to check your payment.'},403);}
 const id=new URL(r.url).searchParams.get('id')||'';if(!/^[0-9a-f-]{36}$/.test(id))return json({error:'Invalid payment reference.'},400);
 const p=await readEwayPayment(id);if(!p)return json({error:'Payment not found.'},404);
 let record;try{record=await readQuote(r,p.quote_id,user) as {quote:Quote;owner:string};}catch{return json({error:'You do not have access to this quote.'},403);}
 try{
  const payment=await verifyEwayPayment(p);
  const q=payment.mode==='live'&&payment.status==='succeeded'?await markLivePaymentAccepted(p,record,payment.transactionId):record.quote;
  const order=payment.mode==='live'&&payment.status==='succeeded'&&q.status==='Accepted'?await createOrderFromQuote({quote:q,owner:record.owner,paymentMethod:'card',paymentStatus:'Paid',paymentReference:payment.transactionId}):null;
  return json({...payment,quoteNumber:q.number,quoteChanged:q.version!==p.quote_version&&q.status!=='Accepted',quoteStatus:q.status,orderNumber:order?.order_number||null,orderId:order?.public_id||null});
 }catch(e){return json({error:e instanceof EwayError?e.message:'The payment result could not be checked. Please try again.'},e instanceof EwayError?e.status:503);}
}
