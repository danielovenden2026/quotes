import 'server-only';
import {normaliseSku, type CostRecords} from './cost-source';

export type MarginItem = {sku:string;price:number;qty:number;optional:boolean;selected:boolean};
export type Margin = {pct:number|null;low:boolean;reason:string};
export function parseMarginItems(value:unknown):MarginItem[] {
  if(!Array.isArray(value)||value.length>50)throw new Error('Invalid product list');
  const seen=new Set<string>();
  return value.map(i=>{
    if(!i||typeof i.sku!=='string'||!i.sku.trim()||i.sku.length>100||!Number.isInteger(i.price)||i.price<0||i.price>100000000||!Number.isInteger(i.qty)||i.qty<0||i.qty>10000||typeof i.optional!=='boolean'||typeof i.selected!=='boolean')throw new Error('Invalid product line');
    const key=normaliseSku(i.sku);if(seen.has(key))throw new Error('Duplicate SKU');seen.add(key);
    return {sku:i.sku,price:i.price,qty:i.qty,optional:i.optional,selected:i.selected};
  });
}

// Ignore floating-point noise at the exact 40% boundary (less than a billionth of a percentage point).
const belowTarget=(pct:number|null)=>pct!==null&&pct<40-1e-9;
export function calculateMargins(items:MarginItem[],costs:CostRecords,magentoSkus:Set<string>) {
  let revenue=0,costTotal=0,missing=0,unpriced=0,included=0;
  const lines=items.map(item=>{
    const key=normaliseSku(item.sku);
    const cost=magentoSkus.has(key)?costs.get(key)?.averageCost:null;
    const known=cost!==null&&cost!==undefined&&Number.isFinite(cost);
    const pct=known&&item.price>0?(item.price-cost*100)/item.price*100:null;
    const low=belowTarget(pct);
    if((!item.optional||item.selected)&&item.qty>0){
      included++;revenue+=item.price*item.qty;
      if(known)costTotal+=cost*100*item.qty;else missing++;
      if(item.price<=0)unpriced++;
    }
    return {sku:item.sku,pct,low,reason:!known?'Average Cost missing':item.price<=0?'Enter a quoted price':low?'Below 40%':'At least 40%'};
  });
  const pct=!missing&&!unpriced&&revenue>0?(revenue-costTotal)/revenue*100:null;
  const overall:Margin={pct,low:belowTarget(pct),reason:missing?missing+' included '+(missing===1?'product is':'products are')+' missing Average Cost.':unpriced?'Enter a quoted price for every included product.':!included||revenue<=0?'No products with a positive quoted total.':belowTarget(pct)?'Below the 40% target':'At or above the 40% target'};
  return {lines,overall};
}
