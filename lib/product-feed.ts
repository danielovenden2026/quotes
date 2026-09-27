import {XMLParser, XMLValidator} from 'fast-xml-parser';
import type {Item} from './quote';

export const FEED_URL='https://www.verdex.com.au/media/feed/quotefeed.xml';
export type FeedProduct=Item & {regularPrice:number;salePrice?:number;saleEndsAt?:string;description:string};
export type CatalogueResponse={products:FeedProduct[];fetchedAt:string;source:'feed'|'snapshot';warning?:string;skipped:number};
const value=(row:Record<string,unknown>,key:string)=>String(row[key]??'').trim();
export function priceCents(raw:string):number|null {
 const m=raw.trim().match(/^((?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?)\s*(?:AUD)?$/i);
 if(!m)return null;
 const cents=Math.round(Number(m[1].replaceAll(',',''))*100);
 return Number.isSafeInteger(cents)&&cents<=100000000?cents:null;
}
function safeUrl(raw:string){try{const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password?u.href:undefined;}catch{return undefined;}}
export function normalizeProducts(rows:Record<string,unknown>[],now=Date.now()) {
 const products:FeedProduct[]=[];const seen=new Set<string>();let skipped=0;
 for(const row of rows){
  const sku=value(row,'g:id'),name=value(row,'title'),regularPrice=priceCents(value(row,'g:price'));
  if(!sku||sku.length>100||!name||name.length>250||regularPrice===null||seen.has(sku)){skipped++;continue;}
  seen.add(sku);
  const sale=priceCents(value(row,'g:sale_price')),dates=value(row,'g:sale_price_effective_date');
  const range=dates.split('/').map(x=>Date.parse(x));
  const active=!dates||(range.length===2&&range.every(Number.isFinite)&&range[0]<=now&&now<=range[1]);
  products.push({sku,name,regularPrice,price:regularPrice,...(sale!==null&&sale>0&&sale<regularPrice&&active?{salePrice:sale,...(dates?{saleEndsAt:new Date(range[1]).toISOString()}: {})}:{}),description:value(row,'description'),image:safeUrl(value(row,'g:image_link')),url:safeUrl(value(row,'link')),qty:1,baseQty:1,optional:false,selected:true,note:''});
 }
 if(!products.length)throw new Error('No valid products in feed');
 return {products,skipped};
}
export function parseFeed(xml:string,now=Date.now()){
 if(xml.length>10000000||/<!DOCTYPE|<!ENTITY/i.test(xml)||XMLValidator.validate(xml)!==true)throw new Error('Invalid product feed');
 const data=new XMLParser({parseTagValue:false,ignoreAttributes:true}).parse(xml);
 const rows=data?.rss?.channel?.item;
 if(!rows)throw new Error('Feed has no items');
 return normalizeProducts(Array.isArray(rows)?rows:[rows],now);
}
