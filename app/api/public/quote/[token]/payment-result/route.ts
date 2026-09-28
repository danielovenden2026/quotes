import {sharedQuote} from '@/lib/public-quote';
import {EwayError} from '@/lib/eway';
import {readEwayPayment,verifyEwayPayment} from '@/lib/eway-payment';
import {db} from '@/lib/store';
import {createOrderFromQuote} from '@/lib/orders';
import type {Quote} from '@/lib/quote';

const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store, private','X-Robots-Tag':'noindex, nofollow'}});

async function acceptPaidQuote(payment:NonNullable<Awaited<ReturnType<typeof readEwayPayment>>>,quote:Quote,owner:string,transactionId:string|null){
 if(quote.status==='Accepted')return quote;
 if(quote.version!==payment.quote_version||quote.status!=='Ready')return quote;
 const q=structuredClone(quote),at=new Date().toISOString();
 const payer=[q.checkout?.billing?.firstName,q.checkout?.billing?.lastName].filter(Boolean).join(' ').trim()||q.contact||'Customer';
 q.status='Accepted';q.acceptedAt=at;q.acceptedBy=payer;q.payment='card';
 q.events.push({at,text:'Live eWAY card payment confirmed'+(transactionId?' · Transaction '+transactionId:'')});
 q.version++;
 const updated=await db().prepare('UPDATE quotes SET data=?,version=?,updated=? WHERE id=? AND owner=? AND version=?').bind(JSON.stringify(q),q.version,at,q.id,owner,payment.quote_version).run();
 return updated.meta.changes?q:quote;
}

export async function POST(r:Request,{params}:any){
 if(r.headers.get('origin')!==new URL(r.url).origin)return json({error:'Request origin is not allowed.'},403);
 const token=(await params).token,record=await sharedQuote(token);
 if(!record)return json({error:'This quotation link is invalid or no longer available.'},404);
 const id=new URL(r.url).searchParams.get('id')||'';
 if(!/^[0-9a-f-]{36}$/.test(id))return json({error:'Invalid payment reference.'},400);
 const p=await readEwayPayment(id);
 if(!p||p.quote_id!==record.quote.id)return json({error:'Payment not found for this quotation.'},404);
 try{
  const payment=await verifyEwayPayment(p);
  const q=payment.mode==='live'&&payment.status==='succeeded'?await acceptPaidQuote(p,record.quote,record.owner,payment.transactionId):record.quote;
  const order=payment.mode==='live'&&payment.status==='succeeded'&&q.status==='Accepted'?await createOrderFromQuote({quote:q,owner:record.owner,paymentMethod:'card',paymentStatus:'Paid',paymentReference:payment.transactionId}):null;
  return json({...payment,quoteNumber:q.number,quoteStatus:q.status,orderNumber:order?.order_number||null,orderId:order?.public_id||null});
 }catch(e){return json({error:e instanceof EwayError?e.message:'The payment result could not be checked. Please try again.'},e instanceof EwayError?e.status:503);}
}
