import {validDiscount} from './line-pricing';
import 'server-only';
import {lineCostKey,type MarginItem} from './margin-math';
export {calculateMargins,type MarginItem,type Margin} from './margin-math';

export function parseMarginItems(value:unknown):MarginItem[] {
  if(!Array.isArray(value)||value.length>50)throw new Error('Invalid product list');
  const seen=new Set<string>();
  return value.map(i=>{
    if(!i||typeof i.sku!=='string'||!i.sku.trim()||i.sku.length>100||!Number.isInteger(i.price)||i.price<0||i.price>100000000||!Number.isInteger(i.qty)||i.qty<0||i.qty>10000||typeof i.optional!=='boolean'||typeof i.selected!=='boolean')throw new Error('Invalid product line');
    if(i.adhocId!==undefined&&(typeof i.adhocId!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(i.adhocId)))throw Error('Invalid custom product');
    if(i.lineId!==undefined&&(typeof i.lineId!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(i.lineId)))throw Error('Invalid quote line');
    if(!validDiscount(i))throw Error('Invalid line discount');
    const key=lineCostKey(i);if(seen.has(key))throw new Error('Duplicate quote line');seen.add(key);
    return {...(i.lineId?{lineId:i.lineId}:{}),...(i.adhocId?{adhocId:i.adhocId}:{}),sku:i.sku,price:i.price,...(typeof i.autoOptionFor==='string'&&i.autoOptionFor.length<=100?{autoOptionFor:i.autoOptionFor}:{}),...(i.discount?{discount:{type:i.discount.type,value:i.discount.value}}:{}),qty:i.qty,optional:i.optional,selected:i.selected};
  });
}
