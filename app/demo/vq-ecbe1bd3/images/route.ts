import {env} from 'cloudflare:workers';
import {db} from '@/lib/store';
import {getAdhoc,adhocImages} from '@/lib/adhoc-products';
import {normaliseSku} from '@/lib/cost-source';
import {privateHeaders} from '@/lib/admin-access';
import type {Quote} from '@/lib/quote';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const params=new URL(request.url).searchParams,sku=normaliseSku(params.get('sku')||''),index=Number(params.get('index')||0);
 if(!sku||sku.length>100||!Number.isInteger(index)||index<0||index>=8)return new Response(null,{status:404,headers:privateHeaders});
 try{
  const saved=await db().prepare('SELECT data,owner FROM quotes WHERE id=?').bind('ecbe1bd3-9939-4a26-8c74-a6804110f4b7').first<{data:string;owner:string}>();
  if(!saved||!env.BUCKET)return new Response(null,{status:404,headers:privateHeaders});
  const quote=JSON.parse(saved.data) as Quote,item=quote.number==='VQ-ECBE1BD3'?quote.items.find(i=>normaliseSku(i.sku)===sku&&(!params.get('lineId')||i.lineId===params.get('lineId'))):undefined;
  const row=item?.adhocId?await getAdhoc(item.adhocId,saved.owner):null;
  const selected=row&&row.quote_id===quote.id?adhocImages(row)[index]:undefined;
  if(selected?.url)return new Response(null,{status:302,headers:{...privateHeaders,Location:selected.url}});
  const object=selected?await env.BUCKET.get(selected.key):null;
  if(!object||!selected)return new Response(null,{status:404,headers:privateHeaders});
  return new Response(object.body,{headers:{...privateHeaders,'Content-Type':selected.type,'Content-Security-Policy':"default-src 'none'; sandbox"}});
 }catch{return new Response(null,{status:503,headers:privateHeaders});}
}
