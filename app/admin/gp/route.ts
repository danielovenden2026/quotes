import {env} from 'cloudflare:workers';
import {adminAccess,privateHeaders,escapeHtml} from '@/lib/admin-access';
import {parseMarginItems} from '@/lib/gross-profit';
import {reviewMargins} from '@/lib/margin-review';
export const dynamic='force-dynamic';
function html(content:string,status=200){
  return new Response('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Product GP</title><style>*{box-sizing:border-box}body{margin:0;font:14px/1.5 Arial,sans-serif;color:#233746;background:transparent}.line{min-height:40px;display:flex;align-items:center;font-weight:700}.line.low{color:#a84709}.box{border:2px solid #c5dfd4;border-radius:8px;background:#f0f8f4;padding:18px}.box.low{background:#fff2e4;border-color:#e6a360}.box.unknown{background:#f4f7fa;border-color:#dce4eb}.label{font-size:14px;font-weight:700}.value{display:block;font-size:38px;line-height:1.3;letter-spacing:-1px;margin:6px 0;color:#176148}.low .value{color:#a84709}.unknown .value{color:#627587}.reason{font-size:13px;margin:5px 0}.basis{font-size:12px;color:#627587;margin:10px 0 0}</style></head><body>'+content+'</body></html>',{status,headers:{...privateHeaders,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'self'; sandbox",'X-Frame-Options':'SAMEORIGIN'}});
}
export async function POST(request:Request){
  const access=adminAccess(request,env);
  if(access!==200)return html('<p>Admin access required</p>',access);
  if(request.headers.get('origin')!==new URL(request.url).origin)return html('<p>Access denied</p>',403);
  let items,summary=false;
  try{const raw=await request.text();if(raw.length>60000)throw Error();const form=new URLSearchParams(raw);summary=form.get('kind')==='summary';items=parseMarginItems(JSON.parse(form.get('items')||'null'));if(!summary&&items.length!==1)throw Error();}catch{return html('<p>Check quoted prices and quantities.</p>',400);}
  try{
    const result=await reviewMargins(items), margin=summary?result.overall:result.lines[0];
    const percent=margin.pct===null?'N/A':(margin.low&&margin.pct.toFixed(1)==='40.0'?'<40.0':margin.pct.toFixed(1))+'%';
    if(!summary)return html('<span class="line '+(margin.low?'low':'')+'" title="'+escapeHtml(margin.reason)+'">'+escapeHtml(percent)+'</span>');
    return html('<section class="box '+(margin.pct===null?'unknown':margin.low?'low':'')+'"><div class="label">Overall product GP%</div><strong class="value">'+escapeHtml(percent)+'</strong><p class="reason">'+escapeHtml(margin.reason)+'</p><p class="basis">Based on quoted prices and Average Cost. Includes selected extras. Excludes freight, handling and GST.</p></section>');
  }catch{return html('<section class="box unknown"><div class="label">'+(summary?'Overall product GP%':'Line GP%')+'</div><strong>N/A</strong><p>Cost data unavailable. Try again shortly.</p></section>',503);}
}
