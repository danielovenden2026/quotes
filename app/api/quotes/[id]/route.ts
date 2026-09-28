import {actor,readQuote,requirePermission} from '@/lib/workspace-access';
import {resolvePreparer} from '@/lib/quote-preparer';
import {enforceQuoteRules} from '@/lib/quote-governance';
import {getApprovalSettings} from '@/lib/approval-settings';
import {totals} from '@/lib/quote';
import {privateHeaders} from '@/lib/admin-access';
import {withExoProducts} from '@/lib/exo-catalogue';
import {getAutoOptionsSettings} from '@/lib/auto-options-settings';
import {syncAutoOptions} from '@/lib/auto-options';
import {getCatalogue} from '@/lib/catalogue-data';
import {refreshCustomerFreight} from '@/lib/customer-freight';
import {verifyAdhocItems} from '@/lib/adhoc-products';
import {db,safeRequest,fail} from '@/lib/store';
import {type Quote} from '@/lib/quote';
import {withStandardPrices} from '@/lib/standard-prices';
import {applyQuoteAction} from '@/lib/quote-actions';
async function get(r:Request,id:string){return withStandardPrices((await readQuote(r,id)).quote as Quote);}
export async function GET(r:Request,{params}:any){try{return Response.json(await get(r,(await params).id),{headers:{'Cache-Control':'no-store'}});}catch(e){return fail(e);}}
export async function PATCH(r:Request,{params}:any){try{safeRequest(r);const id=(await params).id;const user=await actor(r),record=await readQuote(r,id,user),current=await withStandardPrices(record.quote as Quote);const body=await r.json() as any;if(body.action==='ready')await requirePermission(r,'sendQuotes');else if(['save','revise','request-approval','message'].includes(body.action))await requirePermission(r,'createEdit');else await requirePermission(r,'sendQuotes');if(body.action==='customer-freight'&&(r.headers.get('origin')!==new URL(r.url).origin||!r.headers.get('content-type')?.startsWith('application/json')))throw new Error('Invalid freight request.');if(body.action==='save'&&Array.isArray(body.quote?.items)){body.quote.items=await verifyAdhocItems(body.quote.items,current.items,id,record.owner);body.quote=await withExoProducts(body.quote,current);body.quote=await withStandardPrices(body.quote,current);body.quote=syncAutoOptions(body.quote,(await getCatalogue()).products,(await getAutoOptionsSettings()).maxOptions);}const preparer=body.action==='save'?await resolvePreparer(current,body.quote?.salesperson,user):current.salesperson;const q=body.action==='customer-freight'?await refreshCustomerFreight(current,body):applyQuoteAction(current,body);q.salesperson=preparer;if(body.action==='save'&&preparer?.email!==current.salesperson?.email)q.events.push({at:new Date().toISOString(),text:'Prepared By changed to '+preparer?.name+' by '+user.name});await enforceQuoteRules(q,current,r,user,body.action,record.owner);if(['customer','customer-freight','checkout-save'].includes(body.action)&&totals(q).total>totals(current).total&&totals(q).total>(await getApprovalSettings()).highValueCents){q.status='Changes requested';q.events.push({at:new Date().toISOString(),text:'Customer quantity increase requires high-value Administrator approval.'});}const at=new Date().toISOString();const res=await db().prepare('UPDATE quotes SET data=?,version=?,updated=? WHERE id=? AND owner=? AND version=?').bind(JSON.stringify(q),q.version,at,id,record.owner,body.version).run();if(!res.meta.changes)throw new Error('Another change was saved first. Reload the quote.');return Response.json(q,{headers:privateHeaders});
}catch(e){return fail(e);}}
