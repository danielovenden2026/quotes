import {productOwner} from '@/lib/workspace-access';
import {gpHtml as html,renderMargin} from '@/lib/metric-html';
import {costAccess} from '@/lib/admin-access';
import {parseMarginItems} from '@/lib/gross-profit';
import {reviewMargins} from '@/lib/margin-review';
export const dynamic='force-dynamic';

export async function POST(request:Request){
  const access=await costAccess(request);
  if(access!==200)return html('<p>Sign-in required</p>',access);
  if(request.headers.get('origin')!==new URL(request.url).origin)return html('<p>Access denied</p>',403);
  let items,summary=false;
  try{const raw=await request.text();if(raw.length>60000)throw Error();const form=new URLSearchParams(raw);summary=form.get('kind')==='summary';items=parseMarginItems(JSON.parse(form.get('items')||'null'));if(!summary&&items.length!==1)throw Error();}catch{return html('<p>Check quoted prices and quantities.</p>',400);}
  try{
    const custom=items.find(i=>i.adhocId);const quoteOwner=custom?await productOwner(request,custom.adhocId!):undefined;const result=await reviewMargins(items,request,quoteOwner||undefined), margin=summary?result.overall:result.lines[0];
    return renderMargin(margin,summary);
  }catch{return html('<section class="box unknown"><div class="label">'+(summary?'Overall product GP%':'Line GP%')+'</div><strong>N/A</strong><p>Cost data unavailable. Try again shortly.</p></section>',503);}
}
