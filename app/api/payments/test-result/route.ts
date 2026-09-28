import {requirePermission,readQuote} from '@/lib/workspace-access';
import {privateHeaders} from '@/lib/admin-access';
import {EwayError} from '@/lib/eway';
import {readTestPayment,verifyTestPayment} from '@/lib/eway-payment';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:privateHeaders});
export async function POST(r:Request){
 if(r.headers.get('origin')!==new URL(r.url).origin)return json({error:'Request origin is not allowed.'},403);
 let user;try{user=await requirePermission(r,'sendQuotes');}catch{return json({error:'Sign in to check your test payment.'},403);}
 const id=new URL(r.url).searchParams.get('id')||'';if(!/^[0-9a-f-]{36}$/.test(id))return json({error:'Invalid test payment reference.'},400);
 const p=await readTestPayment(id);if(!p)return json({error:'Test payment not found.'},404);
 let q;try{q=(await readQuote(r,p.quote_id,user)).quote;}catch{return json({error:'You do not have access to this quote.'},403);}
 try{return json({...await verifyTestPayment(p),quoteNumber:q.number,quoteChanged:q.version!==p.quote_version});}catch(e){return json({error:e instanceof EwayError?e.message:'The payment result could not be checked. Please try again.'},e instanceof EwayError?e.status:503);}
}
