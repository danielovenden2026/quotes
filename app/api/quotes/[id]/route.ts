import {db,owner,safeRequest,fail} from '@/lib/store';
import {type Quote} from '@/lib/quote';
import {withStandardPrices} from '@/lib/standard-prices';
import {applyQuoteAction} from '@/lib/quote-actions';
async function get(r:Request,id:string){const row=await db().prepare('SELECT data,version FROM quotes WHERE id=? AND owner=?').bind(id,owner(r)).first<any>();if(!row)throw new Error('Quote not found.');return withStandardPrices({...JSON.parse(row.data),version:row.version} as Quote);}
export async function GET(r:Request,{params}:any){try{return Response.json(await get(r,(await params).id),{headers:{'Cache-Control':'no-store'}});}catch(e){return fail(e);}}
export async function PATCH(r:Request,{params}:any){try{safeRequest(r);const id=(await params).id;const current=await get(r,id);const body=await r.json() as any;if(body.action==='save'&&Array.isArray(body.quote?.items)){body.quote=await withStandardPrices(body.quote,current);}const q=applyQuoteAction(current,body);const at=new Date().toISOString();const res=await db().prepare('UPDATE quotes SET data=?,version=?,updated=? WHERE id=? AND owner=? AND version=?').bind(JSON.stringify(q),q.version,at,id,owner(r),body.version).run();if(!res.meta.changes)throw new Error('Another change was saved first. Reload the quote.');return Response.json(q);
}catch(e){return fail(e);}}
