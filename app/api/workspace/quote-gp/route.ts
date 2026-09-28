import {actor} from '@/lib/workspace-access';
import {costAccess,privateHeaders} from '@/lib/admin-access';
import {db} from '@/lib/store';
import {getCosts} from '@/lib/cost-data';
import {getCatalogue} from '@/lib/catalogue-data';
import {getGpSettings} from '@/lib/gp-settings';
import {normaliseSku} from '@/lib/cost-source';
import {calculateMargins} from '@/lib/margin-math';
import type {Quote} from '@/lib/quote';
import type {AdhocRecord} from '@/lib/adhoc-products';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 if(await costAccess(request)!==200)return Response.json({error:'Sign-in required'},{status:401,headers:privateHeaders});
 try{
  const user=await actor(request),owner=user.id;
  const [saved,custom,source,catalogue,{targetPct}]=await Promise.all([
   (user.permissions.viewTeam?db().prepare('SELECT data FROM quotes'):db().prepare('SELECT data FROM quotes WHERE owner = ?').bind(owner)).all<{data:string}>(),
   (user.permissions.viewTeam?db().prepare('SELECT id, quote_id, sku, source_sku, cost_from_feed, cost FROM adhoc_products'):db().prepare('SELECT id, quote_id, sku, source_sku, cost_from_feed, cost FROM adhoc_products WHERE owner = ?').bind(owner)).all<AdhocRecord>(),
   getCosts(),getCatalogue(),getGpSettings(),
  ]);
  const eligible=new Set(catalogue.products.map(p=>normaliseSku(p.sku))),customById=new Map(custom.results.map(row=>[row.id,row]));
  const gp:Record<string,{pct:number|null;low:boolean;reason:string}>=Object.create(null);
  for(const savedRow of saved.results){
   const q=JSON.parse(savedRow.data) as Quote;
   const lineCosts=q.items.map(item=>{
    const sku=normaliseSku(item.sku),feed=eligible.has(sku)?source.get(sku):undefined;
    const feedCost=feed&&!feed.duplicate?feed.averageCost:null;
    if(!item.adhocId)return feedCost;
    const row=customById.get(item.adhocId);
    if(!row||row.quote_id!==q.id||normaliseSku(row.sku)!==sku)return null;
    return row.source_sku&&row.cost_from_feed===1?feedCost:row.cost/100;
   });
   const {pct,low,reason}=calculateMargins(q.items,source,eligible,lineCosts,targetPct).overall;
   gp[q.id]={pct,low,reason};
  }
  // Only aggregate GP for the signed-in user's saved quotes, never source costs.
  return Response.json({gp,targetPct},{headers:privateHeaders});
 }catch{return Response.json({error:'Quote GP could not be loaded. Refresh to try again.'},{status:503,headers:privateHeaders});}
}
