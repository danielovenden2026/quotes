import {privateHeaders,escapeHtml} from './admin-access';
import {formatMarginPct,type Margin} from './margin-math';
export function costCell(text: string, status = 200, title = text) {
  return new Response('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unit Cost</title><style>html,body{margin:0;background:transparent;color:#142a3d;font:14px Arial,sans-serif}body{display:flex;align-items:center;min-height:38px}span{white-space:nowrap}@media(max-height:24px){html,body{font-size:12px}body{min-height:20px}}</style></head><body><span title="' + escapeHtml(title) + '">' + escapeHtml(text) + '</span></body></html>', {
    status, headers:{...privateHeaders, 'Content-Type':'text/html; charset=utf-8', 'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'self'; sandbox", 'X-Frame-Options':'SAMEORIGIN'},
  });
}

export function gpHtml(content:string,status=200){
  return new Response('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Product GP</title><style>*{box-sizing:border-box}body{margin:0;font:14px/1.5 Arial,sans-serif;color:#142a3d;background:transparent}.line{min-height:40px;display:flex;align-items:center;font-weight:700}.line.low{color:#713b00}.box{border:2px solid #116040;border-radius:8px;background:#116040;color:#fff;padding:18px}.box.low{background:#ffe0ad;border-color:#c0812f;color:#713b00}.box.unknown{background:#e5ebf1;border-color:#bacbd9;color:#4c6275}.label{font-size:14px;font-weight:700}.value{display:block;font-size:38px;line-height:1.3;letter-spacing:-1px;margin:6px 0;color:#fff}.low .value{color:#713b00}.unknown .value{color:#4c6275}.reason{font-size:13px;margin:5px 0}.basis{font-size:12px;color:inherit;margin:10px 0 0}</style></head><body>'+content+'</body></html>',{status,headers:{...privateHeaders,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'self'; sandbox",'X-Frame-Options':'SAMEORIGIN'}});
}
export function renderMargin(margin:Margin,summary=false){
    const percent=formatMarginPct(margin);
    if(!summary)return gpHtml('<span class="line '+(margin.low?'low':'')+'" title="'+escapeHtml(margin.reason)+'">'+escapeHtml(percent)+'</span>');
    return gpHtml('<section class="box '+(margin.pct===null?'unknown':margin.low?'low':'')+'"><div class="label">Overall product GP%</div><strong class="value">'+escapeHtml(percent)+'</strong><p class="reason">'+escapeHtml(margin.reason)+'</p><p class="basis">Based on prices after discounts and unit costs (Average Cost or entered custom cost). Includes selected extras. Excludes freight, handling, pickup and GST.</p></section>');
}
