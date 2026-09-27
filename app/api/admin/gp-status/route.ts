import {env} from 'cloudflare:workers';
import {adminAccess,privateHeaders} from '@/lib/admin-access';
import {parseMarginItems} from '@/lib/gross-profit';
import {reviewMargins} from '@/lib/margin-review';
export const dynamic='force-dynamic';
export async function POST(request:Request){
  const access=adminAccess(request,env);
  if(access!==200)return Response.json({error:'Admin access required'},{status:access,headers:privateHeaders});
  if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Invalid origin'},{status:403,headers:privateHeaders});
  let items;
  try{const raw=await request.text();if(raw.length>30000)throw Error();items=parseMarginItems(JSON.parse(raw).items);}catch{return Response.json({error:'Check product quantities and quoted prices.'},{status:400,headers:privateHeaders});}
  try{
    const result=await reviewMargins(items);
    // Only the threshold flags reach parent JavaScript. GP numbers and costs
    // stay in separately authorised, sandboxed HTML frames.
    return Response.json({lowSkus:result.lines.filter(line=>line.low).map(line=>line.sku)},{headers:privateHeaders});
  }catch{return Response.json({error:'GP unavailable. Cost data could not be loaded.'},{status:503,headers:privateHeaders});}
}
