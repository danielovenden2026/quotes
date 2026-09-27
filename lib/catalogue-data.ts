import {FEED_URL,parseFeed,normalizeProducts,type CatalogueResponse} from '@/lib/product-feed';
import snapshot from '@/lib/catalogue-snapshot.json';

let cached:CatalogueResponse|undefined;
let nextCheck=0;
async function refresh():Promise<CatalogueResponse>{
 try{
  const response=await fetch(FEED_URL,{signal:AbortSignal.timeout(20000),redirect:'manual',headers:{Accept:'application/xml,text/xml'}});
  if(!response.ok)throw new Error('Feed returned HTTP '+response.status);
  if(Number(response.headers.get('content-length'))>10000000)throw new Error('Feed too large');
  const parsed=parseFeed(await response.text());
  cached={...parsed,fetchedAt:new Date().toISOString(),source:'feed'};
  nextCheck=Date.now()+15*60*1000;
 }catch(error){
  console.warn('Verdex feed refresh failed:',error instanceof Error?error.message:'Unknown error');
  const last=cached??{...normalizeProducts(snapshot.items),fetchedAt:snapshot.fetchedAt,source:'snapshot' as const};
  cached={...last,warning:'The latest feed could not be loaded. Showing the last available catalogue; check prices before sending a quote.'};
  nextCheck=Date.now()+60000;
 }
 return cached!;
}
export async function getCatalogue():Promise<CatalogueResponse>{
 // Only completed catalogue data is shared across Worker request lifetimes.
 if(!cached||Date.now()>=nextCheck)return refresh();
 return cached!;
}
