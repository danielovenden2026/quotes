import 'server-only';
import {FEED_URL,parseFeed,normalizeProducts,type CatalogueResponse} from '@/lib/product-feed';
import {getFeedSettings} from './connection-settings';
import snapshot from '@/lib/catalogue-snapshot.json';
let cached:CatalogueResponse|undefined,nextCheck=0,sourceUrl='',sourceInterval=15;
export async function fetchCatalogue(url:string):Promise<CatalogueResponse>{
 const response=await fetch(url,{signal:AbortSignal.timeout(20000),redirect:'manual',headers:{Accept:'application/xml,text/xml'}});
 if(!response.ok)throw Error('The XML feed could not be loaded. Check the URL and public access.');
 if(Number(response.headers.get('content-length'))>10000000||!response.body)throw Error('The XML feed is too large or empty.');
 const reader=response.body.getReader(),decoder=new TextDecoder();let xml='',size=0;
 try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>10000000)throw Error('The XML feed is too large.');xml+=decoder.decode(part.value,{stream:true});}xml+=decoder.decode();}finally{await reader.cancel();reader.releaseLock();}
 return {...parseFeed(xml),fetchedAt:new Date().toISOString(),source:'feed'};
}
export function seedCatalogue(url:string,value:CatalogueResponse,refreshMinutes=15){sourceUrl=url;sourceInterval=refreshMinutes;cached=value;nextCheck=Date.now()+refreshMinutes*60000;}
export async function getCatalogue(force=false):Promise<CatalogueResponse>{
 const {url,refreshMinutes}=await getFeedSettings();if(sourceUrl!==url){sourceUrl=url;cached=undefined;nextCheck=0;}
 if(sourceInterval!==refreshMinutes){sourceInterval=refreshMinutes;nextCheck=0;}
 if(force||!cached||Date.now()>=nextCheck){
  try{seedCatalogue(url,await fetchCatalogue(url),refreshMinutes);}
  catch{
   const last=cached??(url===FEED_URL?{...normalizeProducts(snapshot.items),fetchedAt:snapshot.fetchedAt,source:'snapshot' as const}:{products:[],skipped:0,fetchedAt:'',source:'feed' as const});
   cached={...last,warning:'The latest feed could not be loaded. Showing the last available catalogue; check prices before sending a quote.'};nextCheck=Date.now()+60000;
  }
 }
 return cached!;
}
