import {getGpSettings} from '@/lib/gp-settings';
import {lineCostKey} from '@/lib/margin-math';
import {privateHeaders} from '@/lib/admin-access';
import {liveDemoMetrics} from '@/lib/live-demo-metrics';
import {costCell,gpHtml,renderMargin} from '@/lib/metric-html';
import {calculateMargins} from '@/lib/gross-profit';
import {parseDemoMarginItems,withDemoCosts} from '@/lib/demo-cost-overrides';
import {normaliseSku} from '@/lib/cost-source';
import {emptyStock,type StockLevels} from '@/lib/stock';
export const dynamic='force-dynamic';
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:privateHeaders});
export async function GET(request:Request,{params}:any){
 if((await params).kind!=='cost')return json({error:'Not found'},404);
 const query=new URL(request.url).searchParams,sku=normaliseSku(query.get('sku')||''),lineId=query.get('lineId')||undefined;
 if(!sku||sku.length>100)return costCell('N/A',400);
 try{const records=(await liveDemoMetrics(false,'VQ-4BE95871'));const row=records.get(lineCostKey({sku,lineId}))||records.get(sku);return row?.averageCost===null||row?.averageCost===undefined?costCell('N/A',200,'Cost missing or product not included in the shared quotation'):costCell(new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(row.averageCost),200,'Live Unit Cost · AUD');}catch{return costCell('Unavailable',503,'Cost source unavailable. Use Refresh costs and GP.');}
}
export async function POST(request:Request,{params}:any){
 const kind=(await params).kind;
 if(!['refresh','stock','status','gp','quote-gp'].includes(kind))return json({error:'Not found'},404);
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Invalid origin'},403);
 let items,skus:string[]=[],summary=false;
 try{
  const raw=await request.text();if(raw.length>60000)throw Error();
  if(kind==='stock'){const value=JSON.parse(raw).skus;if(!Array.isArray(value)||value.length>50||value.some(s=>typeof s!=='string'||!s.trim()||s.length>100))throw Error();skus=[...new Set<string>(value.map(normaliseSku))];}
  else if(kind!=='refresh'){
   const form=new URLSearchParams(raw);summary=form.get('kind')==='summary';items=parseDemoMarginItems(kind==='gp'?JSON.parse(form.get('items')||'null'):JSON.parse(raw).items);
   if(items.some(i=>i.adhocId)||(kind==='gp'&&!summary&&items.length!==1))throw Error();
  }
 }catch{return kind==='gp'?gpHtml('<p>Check quoted prices and quantities.</p>',400):json({error:'Invalid product list'},400);}
 try{
  const records=await liveDemoMetrics(kind==='refresh','VQ-4BE95871');
  if(kind==='refresh')return json({ok:true});
  if(kind==='stock'){
   const stock:Record<string,StockLevels>=Object.create(null);
   for(const sku of skus){const value=records.get(sku)?.stock;stock[sku]=value?{totalStock:value.totalStock,committedStock:value.committedStock??null,melbourne:value.melbourne,brisbane:value.brisbane,sydney:value.sydney}:emptyStock();}
   return json({stock});
  }
  const effectiveCosts=withDemoCosts(records,items!);
  const {targetPct,minimumSavePct}=await getGpSettings();
  const result=calculateMargins(items!,effectiveCosts,new Set(effectiveCosts.keys()),undefined,targetPct);
  if(kind==='quote-gp'){const {pct,low,reason}=result.overall;return json({pct,low,reason,targetPct});}
  if(kind==='status')return json({minimumSavePct,blockedLines:result.lines.filter((line,index)=>items![index].qty>0&&(!items![index].optional||!items![index].autoOptionFor||items![index].selected)&&line.pct!==null&&line.pct<minimumSavePct-1e-9).map(line=>line.lineId||line.sku),targetPct:result.targetPct,lowSkus:result.lines.filter(line=>line.low).map(line=>line.sku),lowLines:result.lines.filter(line=>line.low).map(line=>line.lineId||line.sku)});
  return renderMargin(summary?result.overall:result.lines[0],summary);
 }catch{return kind==='gp'?gpHtml('<p>Costs unavailable. Use Refresh costs and GP.</p>',503):json({error:'Costs and stock could not be loaded. Please retry.'},503);}
}
