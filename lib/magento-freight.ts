import 'server-only';
import {env} from 'cloudflare:workers';
import {z} from 'zod';
import {australianStates,stateNames} from './delivery-address';
import type {FreightRate} from './freight';
export const MAGENTO_BASE='https://www.verdex.com.au';
const key='integrations/magento-freight/settings-v1';
export const storeSchema=z.string().trim().regex(/^[A-Za-z0-9_]{1,64}$/,'Enter a valid Magento store code.');
export const inputSchema=z.object({address:z.string().trim().max(500).default(''),suburb:z.string().trim().max(100).default(''),state:z.enum(australianStates),postcode:z.string().regex(/^\d{4}$/,'Enter a four-digit postcode.'),items:z.array(z.object({sku:z.string().trim().min(1).max(100),qty:z.number().int().min(1).max(10000),price:z.number().int().min(0).max(100000000).optional(),custom:z.boolean().default(false)})).min(1).max(50)});
export type MagentoSettings={storeCode:string;enabled:boolean;testedAt?:string;testAmount?:number};
export class FreightError extends Error{constructor(message:string,public diagnostics?:{stage:string;status?:number;rayId?:string;time:string}){super(message);}}
export async function getMagentoSettings():Promise<MagentoSettings>{const object=await env.BUCKET?.get(key);if(!object)return {storeCode:'default',enabled:false};const value=await object.json<MagentoSettings>();return {...value,storeCode:storeSchema.parse(value.storeCode),enabled:value.enabled===true};}
export async function saveMagentoSettings(value:MagentoSettings){if(!env.BUCKET)throw new FreightError('Connection storage is unavailable.');await env.BUCKET.put(key,JSON.stringify(value),{httpMetadata:{contentType:'application/json'}});}
export async function estimateMagento(storeCode:string,raw:unknown):Promise<FreightRate[]>{
 const store=storeSchema.parse(storeCode),input=inputSchema.parse(raw),quantities=new Map<string,number>();
 if(input.items.some(i=>i.custom))throw new FreightError('This quote contains ad hoc products without Magento SKUs. Enter freight manually for the complete shipment.');
 for(const item of input.items)quantities.set(item.sku,(quantities.get(item.sku)||0)+item.qty);
 if(quantities.size>40)throw new FreightError('Automatic freight supports up to 40 different SKUs per shipment. Enter freight manually for this quote.');
 if([...quantities.values()].some(q=>q>10000))throw new FreightError('The combined quantity for a SKU exceeds 10,000. Enter freight manually.');
 const signal=AbortSignal.timeout(55000);
 async function request(path:string,stage:string,body?:unknown){
  let response:Response;try{response=await fetch(MAGENTO_BASE+'/rest/'+store+'/V1/'+path,{method:body===undefined?'GET':'POST',headers:{Accept:'application/json',...(body!==undefined?{'Content-Type':'application/json'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{}),redirect:'manual',signal,cache:'no-store'});}catch{throw new FreightError('Magento could not be reached or timed out. Your freight amount has not been changed.',{stage,time:new Date().toISOString()});}
  const ray=response.headers.get('cf-ray')||'',diagnostics={stage,status:response.status,...(/^[a-zA-Z0-9-]{1,100}$/.test(ray)?{rayId:ray}:{}),time:new Date().toISOString()};
  if(!response.ok){await response.body?.cancel();throw new FreightError(response.status===403?'Magento blocked the connection (403). Check the matching security event using the details below.':response.status===429?'Magento is receiving too many requests. Please wait before trying again.':`Magento could not complete ${stage} (${response.status}). Check that the products are available in this store.`,diagnostics);}
  if(!response.headers.get('content-type')?.includes('application/json')||!response.body){await response.body?.cancel();throw new FreightError('Magento returned an unexpected response. Check the store code and website security settings.',diagnostics);}
  const reader=response.body.getReader(),decoder=new TextDecoder();let text='',bytes=0;
  try{for(;;){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>1000000)throw Error();text+=decoder.decode(part.value,{stream:true});}return JSON.parse(text+decoder.decode());}catch{throw new FreightError('Magento returned an unreadable response.',diagnostics);}finally{await reader.cancel();reader.releaseLock();}
 }
 const country=await request('directory/countries/AU','destination lookup');
 const region=country.available_regions?.find((r:any)=>r.code===input.state||r.name===stateNames[input.state]);
 if(!region||!/^\d+$/.test(String(region.id)))throw new FreightError('The destination state could not be matched in Magento.');
 const cart=await request('guest-carts','cart creation',{});
 if(typeof cart!=='string'||!/^[A-Za-z0-9_-]{16,100}$/.test(cart))throw new FreightError('Magento did not return a valid calculation cart.');
 const prefix='guest-carts/'+encodeURIComponent(cart);
 const details=await request(prefix,'currency check');
 if(details.currency?.quote_currency_code!=='AUD')throw new FreightError('The Magento store must use AUD for freight quotes.');
 // Add every SKU successfully before requesting a price; never estimate a partial cart.
 for(const [sku,qty] of quantities){const added=await request(prefix+'/items','adding product '+sku,{cartItem:{sku,qty,quote_id:cart}});if(added.sku!==sku||Number(added.qty)!==qty)throw new FreightError('Magento could not add the requested quantity of '+sku+'. No partial freight estimate was used.');}
 const result=await request(prefix+'/estimate-shipping-methods','shipping estimate',{address:{country_id:'AU',region_id:Number(region.id),region:stateNames[input.state],region_code:input.state,postcode:input.postcode,...(input.suburb?{city:input.suburb}:{}),...(input.address?{street:[input.address]}:{})}});
 if(!Array.isArray(result))throw new FreightError('Magento did not return shipping options.');
 const rates:FreightRate[]=result.filter((r:any)=>r.available===true&&!r.error_message&&r.carrier_code==='carriertablerate'&&typeof r.method_code==='string'&&r.method_code.length>0&&r.method_code.length<=100&&typeof r.price_excl_tax==='number'&&Number.isFinite(r.price_excl_tax)&&r.price_excl_tax>=0&&r.price_excl_tax<=1000000).map((r:any)=>({carrierCode:r.carrier_code,methodCode:r.method_code,label:String(r.method_title||r.carrier_title||'Delivery').slice(0,200),amount:Math.round(r.price_excl_tax*100)}));
 if(!rates.length)throw new FreightError('Magento returned no available carrier delivery rate for this shipment. Enter freight manually or check the destination and products.');
 return rates;
}
