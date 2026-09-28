import {readQuote} from '@/lib/workspace-access';
import {getGpSettings} from '@/lib/gp-settings';
import {staffAccess,privateHeaders} from '@/lib/admin-access';
import {parseMarginItems} from '@/lib/gross-profit';
import {reviewMargins} from '@/lib/margin-review';
export const dynamic='force-dynamic';
export async function POST(request:Request){
  const access=await staffAccess(request);
  if(access!==200)return Response.json({error:'Sign-in required'},{status:access,headers:privateHeaders});
  if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Invalid origin'},{status:403,headers:privateHeaders});
  let items,quoteId:string|undefined;
  try{const raw=await request.text();if(raw.length>30000)throw Error();const body=JSON.parse(raw);items=parseMarginItems(body.items);quoteId=body.quoteId;}catch{return Response.json({error:'Check product quantities and quoted prices.'},{status:400,headers:privateHeaders});}
  try{
    const quoteOwner=quoteId?(await readQuote(request,quoteId)).owner:undefined;const result=await reviewMargins(items,request,quoteOwner);const {minimumSavePct}=await getGpSettings();
    // Only the threshold flags reach parent JavaScript. GP numbers and costs
    // stay in separately authorised, sandboxed HTML frames.
    return Response.json({minimumSavePct,unknownLines:result.lines.filter((line,index)=>items[index].qty>0&&(!items[index].optional||!items[index].autoOptionFor||items[index].selected)&&line.pct===null).map(line=>line.lineId||line.sku),blockedLines:result.lines.filter((line,index)=>items[index].qty>0&&(!items[index].optional||!items[index].autoOptionFor||items[index].selected)&&line.pct!==null&&line.pct<minimumSavePct-1e-9).map(line=>line.lineId||line.sku),targetPct:result.targetPct,lowSkus:result.lines.filter(line=>line.low).map(line=>line.sku),lowLines:result.lines.filter(line=>line.low).map(line=>line.lineId||line.sku)},{headers:privateHeaders});
  }catch{return Response.json({error:'GP unavailable. Cost data could not be loaded.'},{status:503,headers:privateHeaders});}
}
