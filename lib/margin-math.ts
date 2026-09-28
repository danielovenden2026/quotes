import {netUnitPrice,type LineDiscount} from './line-pricing';
// Pure calculations shared by the private workspace and synthetic public demo.
export type MarginItem = {autoOptionFor?:string;discount?:LineDiscount;demoCostLineId?:string;lineId?:string;adhocId?:string;sku:string;price:number;qty:number;optional:boolean;selected:boolean};
export const lineCostKey=(item:{lineId?:string;sku:string})=>item.lineId?'LINE:'+item.lineId.toUpperCase():item.sku.trim().toUpperCase();
export type Margin = {pct:number|null;low:boolean;reason:string;targetPct?:number};
const normaliseSku=(sku:string)=>sku.trim().toUpperCase();

// Ignore floating-point noise at the exact target boundary (less than a billionth of a percentage point).
const belowTarget=(pct:number|null,targetPct:number)=>pct!==null&&pct<targetPct-1e-9;
export function calculateMargins(items:MarginItem[],costs:ReadonlyMap<string,{averageCost:number|null}>,magentoSkus:Set<string>,lineCosts?:readonly (number|null|undefined)[],targetPct=40) {
  let revenue=0,costTotal=0,missing=0,unpriced=0,included=0;
  const lines=items.map((item,index)=>{
    const sourceKey=item.demoCostLineId?'LINE:'+item.demoCostLineId.toUpperCase():normaliseSku(item.sku);
    const key=costs.has(lineCostKey(item))?lineCostKey(item):costs.has(sourceKey)?sourceKey:normaliseSku(item.sku);
    const cost=lineCosts?lineCosts[index]:magentoSkus.has(key)?costs.get(key)?.averageCost:null;
    const price=netUnitPrice(item);
    const known=cost!==null&&cost!==undefined&&Number.isFinite(cost);
    const pct=known&&price>0?(price-cost*100)/price*100:null;
    const low=belowTarget(pct,targetPct);
    if((!item.optional||item.selected)&&item.qty>0){
      included++;revenue+=price*item.qty;
      if(known)costTotal+=cost*100*item.qty;else missing++;
      if(price<=0)unpriced++;
    }
    return {lineId:item.lineId,sku:item.sku,pct,low,targetPct,reason:!known?'Average Cost missing':price<=0?'Enter a quoted price':low?'Below '+targetPct+'%':'At least '+targetPct+'%'};
  });
  const pct=!missing&&!unpriced&&revenue>0?(revenue-costTotal)/revenue*100:null;
  const overall:Margin={pct,targetPct,low:belowTarget(pct,targetPct),reason:missing?missing+' included '+(missing===1?'product is':'products are')+' missing Average Cost.':unpriced?'Enter a quoted price for every included product.':!included||revenue<=0?'No products with a positive quoted total.':belowTarget(pct,targetPct)?'Below the '+targetPct+'% target':'At or above the '+targetPct+'% target'};
  return {lines,overall,targetPct};
}

export function formatMarginPct(margin:Margin){
 if(margin.pct===null)return 'N/A';
 const target=(margin.targetPct??40).toFixed(1),pct=margin.pct.toFixed(1);
 return (margin.low&&pct===target?'<'+target:pct)+'%';
}
