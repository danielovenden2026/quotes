import 'server-only';
import {lineCostKey} from './margin-math';
import {parseMarginItems} from './gross-profit';
import type {CostRecords} from './cost-source';
import {emptyStock} from './stock';
export function parseDemoMarginItems(value:unknown){
 const items=parseMarginItems(value);
 return items.map((item,index)=>{
  const demoCost=(value as any[])[index].demoCost,demoCostLineId=(value as any[])[index].demoCostLineId;
  if(demoCostLineId!==undefined&&(typeof demoCostLineId!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(demoCostLineId)))throw Error('Invalid demo cost reference');
  if(demoCost===undefined)return {...item,demoCostLineId,demoCost:undefined};
  if(!Number.isSafeInteger(demoCost)||demoCost<0||demoCost>100000000)throw Error('Invalid demo cost');
  return {...item,demoCostLineId,demoCost:demoCost as number};
 });
}
export function withDemoCosts(records:CostRecords,items:{lineId?:string;sku:string;demoCost?:number}[]):CostRecords{
 // User-entered values only; never fetch an additional SKU or update source costs.
 const result=new Map(records);
 for(const item of items)if(item.demoCost!==undefined){const key=lineCostKey(item);result.set(key,{averageCost:item.demoCost/100,stock:records.get(key)?.stock||emptyStock()});}
 return result;
}
