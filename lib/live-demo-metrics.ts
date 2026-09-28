import 'server-only';
import {lineCostKey} from './margin-math';
import {db} from './store';
import type {Quote} from './quote';
import {getCosts} from './cost-data';
import {getCatalogue} from './catalogue-data';
import {getAdhoc} from './adhoc-products';
import {normaliseSku,type CostRecords} from './cost-source';
import {emptyStock} from './stock';
// Public disclosure explicitly authorised only for these saved demo quotations.
// Never use a quote ID or custom-product ID supplied by a visitor.
export async function liveDemoMetrics(refresh=false,demo:'VQ-ECBE1BD3'|'VQ-4BE95871'='VQ-ECBE1BD3'){
 const quoteId=({'VQ-ECBE1BD3':'ecbe1bd3-9939-4a26-8c74-a6804110f4b7','VQ-4BE95871':'4be95871-dc22-454a-91fe-c62d29ef553b'} as const)[demo];
 if(!quoteId)throw Error('Demo unavailable');
 const saved=await db().prepare('SELECT data,owner FROM quotes WHERE id=?').bind(quoteId).first<{data:string;owner:string}>();
 if(!saved)throw Error('Demo unavailable');
 const quote=JSON.parse(saved.data) as Quote;
 if(quote.number!==demo)throw Error('Demo unavailable');
 const [source,catalogue]=await Promise.all([getCosts(refresh),getCatalogue()]);
 const catalogueSkus=new Set(catalogue.products.map(p=>normaliseSku(p.sku)));
 const records:CostRecords=new Map();
 for(const item of quote.items){
  const key=normaliseSku(item.sku);
  if(item.adhocId){const custom=await getAdhoc(item.adhocId,saved.owner);if(custom&&custom.quote_id===quote.id&&normaliseSku(custom.sku)===key){const feed=custom.source_sku&&catalogueSkus.has(key)?source.get(key):undefined;records.set(lineCostKey(item),{averageCost:custom.source_sku&&custom.cost_from_feed===1?(feed?.duplicate?null:feed?.averageCost??null):custom.cost/100,stock:feed&&!feed.duplicate?{...feed.stock}:emptyStock()});if(!records.has(key))records.set(key,records.get(lineCostKey(item))!);}continue;}
  if(!catalogueSkus.has(key))continue;
  const row=source.get(key);if(row&&!row.duplicate)records.set(key,{averageCost:row.averageCost,stock:{...row.stock}});
 }
 return records;
}
