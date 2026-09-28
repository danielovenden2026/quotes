import {actor} from './workspace-access';
import 'server-only';
import {getGpSettings} from './gp-settings';
import {getCosts} from './cost-data';
import {getCatalogue} from './catalogue-data';
import {normaliseSku,type CostRecords} from './cost-source';
import {calculateMargins,type MarginItem} from './gross-profit';
import {getAdhoc} from './adhoc-products';
export async function reviewMargins(items:MarginItem[],request:Request,quoteOwner?:string){
 const ownerId=quoteOwner||(await actor(request)).id;
 const rows=await Promise.all(items.map(i=>i.adhocId?getAdhoc(i.adhocId,ownerId):null));
 const hasFeed=items.some((i,index)=>!i.adhocId||!!rows[index]?.source_sku);
 const [source,catalogue]=hasFeed?await Promise.all([getCosts(),getCatalogue()]):[new Map() as CostRecords,{products:[]}];
 const eligible=new Set(catalogue.products.map(p=>normaliseSku(p.sku)));
 const lineCosts=items.map((item,index)=>{
  const sku=normaliseSku(item.sku),row=rows[index];
  const feed=eligible.has(sku)?source.get(sku):undefined;
  const feedCost=feed&&!feed.duplicate?feed.averageCost:null;
  if(!item.adhocId)return feedCost;
  if(!row||normaliseSku(row.sku)!==sku)return null;
  return row.source_sku&&row.cost_from_feed===1?feedCost:row.cost/100;
 });
 const {targetPct}=await getGpSettings();
 return calculateMargins(items,source,eligible,lineCosts,targetPct);
}
