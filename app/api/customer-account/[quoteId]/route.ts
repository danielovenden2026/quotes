import {actor,readQuote} from '@/lib/workspace-access';
import {privateHeaders} from '@/lib/admin-access';
import {db} from '@/lib/store';
import type {Quote} from '@/lib/quote';
import type {OrderRow} from '@/lib/orders';

export async function GET(r:Request,{params}:any){
 try{
  const user=await actor(r),quoteId=(await params).quoteId;
  const source=(await readQuote(r,quoteId,user)).quote as Quote;
  const email=(source.email||'').trim().toLowerCase();
  if(!email)return Response.json({quotes:[],orders:[]},{headers:privateHeaders});
  const quoteRows=user.permissions.viewTeam
   ?await db().prepare('SELECT data,version FROM quotes ORDER BY updated DESC').all()
   :await db().prepare('SELECT data,version FROM quotes WHERE owner=? ORDER BY updated DESC').bind(user.id).all();
  const quotes=quoteRows.results.map((row:any)=>({...JSON.parse(row.data),version:row.version} as Quote))
   .filter(q=>(q.email||'').trim().toLowerCase()===email&&['Ready','Accepted','Declined'].includes(q.status));
  const orderRows=user.permissions.viewTeam
   ?await db().prepare('SELECT * FROM orders WHERE customer_email=? ORDER BY created DESC').bind(email).all<OrderRow>()
   :await db().prepare('SELECT * FROM orders WHERE customer_email=? AND owner=? ORDER BY created DESC').bind(email,user.id).all<OrderRow>();
  const orders=orderRows.results.map(row=>({...row,snapshot:JSON.parse(row.data)}));
  return Response.json({customer:{email,company:source.company,contact:source.contact},quotes,orders},{headers:privateHeaders});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Customer account preview could not be loaded.'},{status:403,headers:privateHeaders});}
}
