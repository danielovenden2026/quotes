import {staffAccess,privateHeaders} from '@/lib/admin-access';
import {getCosts} from '@/lib/cost-data';
import {getCatalogue} from '@/lib/catalogue-data';
import {normaliseSku} from '@/lib/cost-source';
import {emptyStock,type StockLevels} from '@/lib/stock';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 const access=await staffAccess(request);
 if(access!==200)return Response.json({error:'Sign-in required'},{status:access,headers:privateHeaders});
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Invalid origin'},{status:403,headers:privateHeaders});
 let skus:string[];
 try{const raw=await request.text();if(raw.length>10000)throw Error();const body=JSON.parse(raw);if(!Array.isArray(body.skus)||body.skus.length>50||body.skus.some((sku:unknown)=>typeof sku!=='string'||!sku.trim()||sku.length>100))throw Error();skus=[...new Set<string>(body.skus.map(normaliseSku))];}catch{return Response.json({error:'Invalid product list'},{status:400,headers:privateHeaders});}
 try{
  if(!skus.length)return Response.json({stock:{}},{headers:privateHeaders});
  const [records,catalogue]=await Promise.all([getCosts(),getCatalogue()]);
  const allowed=new Set(catalogue.products.map(product=>normaliseSku(product.sku)));
  const stock:Record<string,StockLevels>=Object.create(null);
  for(const sku of skus){const row=allowed.has(sku)?records.get(sku):undefined;const value=row?.duplicate?undefined:row?.stock;
   // Explicit public-to-staff projection: never return cost/source records.
   stock[sku]=value?{totalStock:value.totalStock,committedStock:value.committedStock??null,melbourne:value.melbourne,brisbane:value.brisbane,sydney:value.sydney}:emptyStock();
  }
  return Response.json({stock},{headers:privateHeaders});
 }catch{return Response.json({error:'Stock could not be loaded. Please retry.'},{status:503,headers:privateHeaders});}
}
