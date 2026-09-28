import type {Item} from './quote';
import {calculateMargins,lineCostKey} from './margin-math';
// Fictional cents for demonstration only. No private source or cost API is used.
const sampleCosts:Record<string,number>={V4000:70000,V4070:9000,V4002:14500,V4000A:6500,'DEMO-LANYARD':4200,'DEMO-PINS':2000};
export function demoUnitCost(item:Item):number|null{
 if(item.demoCost!==undefined)return item.demoCost;
 const key=item.sku.trim().toUpperCase();
 if(Object.prototype.hasOwnProperty.call(sampleCosts,key))return sampleCosts[key];
 // Newly added feed products get a clearly labelled synthetic cost from their
 // standard price, so editing quoted prices cannot move their cost basis.
 return Number.isSafeInteger(item.standardPrice)&&(item.standardPrice??0)>0?Math.round(item.standardPrice!*0.6):null;
}
export function reviewDemoMargins(items:Item[],targetPct=40){
 const costs=new Map(items.map(item=>{const cents=demoUnitCost(item);return [lineCostKey(item),{averageCost:cents===null?null:cents/100}];}));
 return calculateMargins(items,costs,new Set(costs.keys()),undefined,targetPct);
}
