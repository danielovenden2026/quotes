import 'server-only';
import {parseCsv,normaliseSku} from './cost-source';
import {getExoSettings,type SheetSettings} from './connection-settings';
import {sanitiseProductDescription} from './product-description';
import type {Item,Quote} from './quote';
import {lineKey} from './quote';
export type ExoCatalogue={products:Item[];fetchedAt:string;skipped:number};
export function parseExoCsv(csv:string):ExoCatalogue{
 const rows=parseCsv(csv).filter(row=>row.some(cell=>cell.trim())),head=rows.shift()?.map(s=>s.trim().toLowerCase().replace(/[^a-z0-9]/g,''))||[];
 const column=(names:string[])=>{const found=head.flatMap((h,i)=>names.includes(h)?[i]:[]);if(found.length>1)throw Error('Duplicate EXO column headings.');return found[0]??-1;};
 const skuCol=column(['sku','stockcode']),nameCol=column(['description','name']),priceCol=column(['sellprice','sellprice1']),htmlCol=column(['saleshtml']);
 if([skuCol,nameCol,priceCol].some(i=>i<0))throw Error('EXO sheet needs SKU, Description and Sell Price columns. Sales HTML is optional.');
 const products:Item[]=[],seen=new Set<string>();let skipped=0;
 for(const row of rows){
  const sku=(row[skuCol]||'').trim(),name=(row[nameCol]||'').trim(),key=normaliseSku(sku),raw=(row[priceCol]||'').trim().replace(/^AUD\s*/i,'').replace(/^\$\s*/,'').replace(/\s*AUD$/i,'');
  if(!sku||sku.length>100||!name||name.length>250||seen.has(key)||!/^\d+(?:,\d{3})*(?:\.\d+)?$/.test(raw)){skipped++;continue;}
  const price=Math.round(Number(raw.replaceAll(',',''))*100);if(!Number.isSafeInteger(price)||price<0||price>100000000){skipped++;continue;}
  seen.add(key);const html=(row[htmlCol]||'').slice(0,30000);
  const description=sanitiseProductDescription(html);
  products.push({productSource:'exo',exoDescriptionHtml:description,sku,name,price,standardPrice:price,qty:1,baseQty:1,optional:false,selected:true,note:''});
 }
 if(!products.length)throw Error('No valid EXO product rows were found. Check SKUs, descriptions and sell prices.');
 return {products,skipped,fetchedAt:new Date().toISOString()};
}
export async function fetchExoCatalogue(settings:SheetSettings):Promise<ExoCatalogue>{
 const url=new URL('https://docs.google.com/spreadsheets/d/'+settings.sheetId+'/gviz/tq');url.search=new URLSearchParams({tqx:'out:csv',sheet:settings.tab,range:'A:Z',headers:'1'}).toString();
 const response=await fetch(url,{headers:{Accept:'text/csv'},redirect:'manual',signal:AbortSignal.timeout(20000),cache:'no-store'});
 if(!response.ok||!response.headers.get('content-type')?.includes('text/csv')||!response.body)throw Error('EXO sheet could not be loaded. Check the spreadsheet, tab and Viewer sharing.');
 if(Number(response.headers.get('content-length'))>20_000_000){await response.body.cancel();throw Error('EXO sheet exceeds 20 MB.');}
 const reader=response.body.getReader(),decoder=new TextDecoder();let csv='',size=0;
 try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>20_000_000)throw Error('EXO sheet exceeds 20 MB.');csv+=decoder.decode(part.value,{stream:true});}csv+=decoder.decode();}finally{await reader.cancel();reader.releaseLock();}
 return parseExoCsv(csv);
}
let cached:ExoCatalogue|undefined,sourceKey='',expires=0;
export function seedExoCatalogue(settings:SheetSettings,value:ExoCatalogue){sourceKey=JSON.stringify(settings);cached=value;expires=Date.now()+settings.refreshMinutes*60_000;}
export async function getExoCatalogue(force=false){const settings=await getExoSettings(),key=JSON.stringify(settings);if(key!==sourceKey){cached=undefined;expires=0;sourceKey=key;}if(force||!cached||Date.now()>=expires)seedExoCatalogue(settings,await fetchExoCatalogue(settings));return cached!;}
export async function withExoProducts(q:Quote,previous:Quote):Promise<Quote>{
 const old=new Map(previous.items.map(i=>[lineKey(i),i]));let catalogue:Map<string,Item>|undefined;
 const items:Item[]=[];
 for(const item of q.items){
  const prior=old.get(lineKey(item));
  if(prior?.productSource==='exo'&&item.productSource!=='exo')throw Error('EXO product source changed. Reload the quote.');
  if(item.productSource!=='exo'){items.push({...item,exoDescriptionHtml:undefined});continue;}
  if(prior?.productSource==='exo'&&normaliseSku(prior.sku)===normaliseSku(item.sku)){items.push({...item,standardPrice:prior.standardPrice??prior.price,exoDescriptionHtml:prior.exoDescriptionHtml});continue;}
  catalogue??=new Map((await getExoCatalogue()).products.map(p=>[normaliseSku(p.sku),p]));const product=catalogue.get(normaliseSku(item.sku));
  if(!product)throw Error('EXO SKU '+item.sku+' was not found. Refresh the EXO search and add it again.');
  items.push({...item,sku:product.sku,name:product.name,standardPrice:product.standardPrice,exoDescriptionHtml:product.exoDescriptionHtml});
 }
 return {...q,items};
}
