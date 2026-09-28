import 'server-only';
import {env} from 'cloudflare:workers';
import {normaliseSku} from './cost-source';
import {lineKey,type Item} from './quote';
export const validAdhocId=(id:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
export type AdhocRecord={id:string;owner:string;quote_id:string;sku:string;name:string;cost:number;price:number;qty:number;image_key:string|null;image_type:string|null;images_json?:string|null;family_id?:string|null;source_sku?:string|null;cost_from_feed?:number};
export async function getAdhoc(id:string,owner:string){
 if(!validAdhocId(id)||!owner)return null;
 if(!env.DB)throw Error('Product storage is unavailable.');
 return env.DB.prepare('SELECT * FROM adhoc_products WHERE id=? AND owner=?').bind(id,owner).first<AdhocRecord>();
}
export function safeFeedImage(value:unknown):string|undefined{try{const u=new URL(String(value||''));return u.protocol==='https:'&&!u.username&&!u.password&&['verdex.com.au','www.verdex.com.au'].includes(u.hostname)&&u.pathname.startsWith('/media/')&&!u.search&&!u.hash?u.href:undefined;}catch{return;}}
export type AdhocImage={key:string;type:string;url?:string};
export function adhocImages(row:AdhocRecord):AdhocImage[]{
 if(row.images_json){try{const parsed=JSON.parse(row.images_json);if(Array.isArray(parsed)&&parsed.length<=8&&parsed.every(i=>i&&((typeof i.key==='string'&&!!i.key&&['image/png','image/jpeg','image/webp'].includes(i.type))||!!safeFeedImage(i.url))))return parsed.map(i=>safeFeedImage(i.url)?{key:'',type:'',url:safeFeedImage(i.url)}:{key:i.key,type:i.type});}catch{/* Legacy metadata fallback. */}}
 return row.image_key?[{key:row.image_key,type:row.image_type||'image/jpeg'}]:[];
}
// Deliberately enumerate customer-safe fields; never spread the private record.
export function publicAdhoc(row:AdhocRecord):Item{
 const images=adhocImages(row).map((_,index)=>'/api/product-images/'+row.id+(index?'?index='+index:''));
 return {...(row.source_sku?{sourceSku:row.source_sku}:{}),adhocId:row.id,sku:row.sku,name:row.name,price:row.price,standardPrice:row.price,qty:row.qty,baseQty:row.qty,optional:false,selected:true,note:'',images,...(images.length?{image:images[0]}:{})};
}
export async function verifyAdhocItems(items:Item[],previous:Item[],quoteId:string,owner:string){
 return Promise.all(items.map(async item=>{
  const prior=previous.find(p=>lineKey(p)===lineKey(item));
  if(prior?.adhocId&&!item.adhocId)throw Error('Custom product reference changed. Reload the quote.');
  if(!item.adhocId)return {...item,sourceSku:undefined};
  const row=await getAdhoc(item.adhocId,owner);
  if(!row||row.quote_id!==quoteId||normaliseSku(row.sku)!==normaliseSku(item.sku))throw Error('Custom product does not belong to this quote.');
  if(prior?.adhocId&&prior.adhocId!==item.adhocId){
   const original=await getAdhoc(prior.adhocId,owner);
   if(!original||original.quote_id!==quoteId||(original.family_id||original.id)!==(row.family_id||row.id))throw Error('Custom product reference changed. Reload the quote.');
  }
  const safe=publicAdhoc(row);
  return {...item,sku:safe.sku,name:safe.name,standardPrice:safe.standardPrice,image:safe.image,images:safe.images,custom:undefined,sourceSku:safe.sourceSku,url:row.source_sku?prior?.url||item.url:undefined};
 }));
}
export function imageType(bytes:Uint8Array):string|null{
 if(bytes.length>=8&&[137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b))return 'image/png';
 if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 if(bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return 'image/webp';
 return null;
}
