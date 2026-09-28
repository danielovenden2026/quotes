import {db,safeRequest} from '@/lib/store';
import {sharedQuote} from '@/lib/public-quote';
import {applyQuoteAction} from '@/lib/quote-actions';
import {refreshCustomerFreight} from '@/lib/customer-freight';
import {getApprovalSettings} from '@/lib/approval-settings';
import {totals,type Quote} from '@/lib/quote';
import {createOrderFromQuote} from '@/lib/orders';

const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store, private','X-Robots-Tag':'noindex, nofollow'}});

function customerView(q:Quote){return {...q,events:[],snapshots:[]};}

export async function GET(_r:Request,{params}:any){
 const token=(await params).token,record=await sharedQuote(token);
 if(!record)return json({error:'This quotation link is invalid or no longer available.'},404);
 return json(customerView(record.quote));
}

export async function PATCH(r:Request,{params}:any){
 try{
  safeRequest(r);
  if(!r.headers.get('content-type')?.startsWith('application/json'))return json({error:'Send a JSON request.'},415);
  const token=(await params).token,record=await sharedQuote(token);
  if(!record)return json({error:'This quotation link is invalid or no longer available.'},404);
  const body=await r.json() as any;
  if(!['customer','customer-freight','checkout-save','message','decline','accept'].includes(body.action))return json({error:'This action is not available from a customer link.'},403);
  if(body.action==='message')body.staff=false;
  if(body.action==='accept'&&body.payment!=='account')return json({error:'Card checkout must be completed through the secure payment page.'},400);
  const current=record.quote;
  const q=body.action==='customer-freight'?await refreshCustomerFreight(current,body):applyQuoteAction(current,body);
  if(['customer','customer-freight','checkout-save'].includes(body.action)&&totals(q).total>totals(current).total&&totals(q).total>(await getApprovalSettings()).highValueCents){
   q.status='Changes requested';q.events.push({at:new Date().toISOString(),text:'Customer quantity increase requires high-value Administrator approval.'});
  }
  const at=new Date().toISOString();
  const res=await db().prepare('UPDATE quotes SET data=?,version=?,updated=? WHERE id=? AND owner=? AND version=?').bind(JSON.stringify(q),q.version,at,q.id,record.owner,body.version).run();
  if(!res.meta.changes)return json({error:'This quotation changed in another window. Reload it and try again.'},409);
  if(body.action==='accept'&&q.status==='Accepted'&&q.payment==='account'){q.events[q.events.length-1].text='Customer accepted quotation on account'+(q.po?' · PO '+q.po:'');
   try{await createOrderFromQuote({quote:q,owner:record.owner,paymentMethod:'account',paymentStatus:'Account terms',paymentReference:q.po||null});}catch(e){console.error('Public account order creation failed',e);}
  }
  return json(customerView(q));
 }catch(e){return json({error:e instanceof Error?e.message:'The quotation could not be updated.'},400);}
}
