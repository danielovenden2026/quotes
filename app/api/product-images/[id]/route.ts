import {productOwner} from '@/lib/workspace-access';
import {env} from 'cloudflare:workers';
import {getAdhoc,adhocImages} from '@/lib/adhoc-products';
import {privateHeaders} from '@/lib/admin-access';
export async function GET(request:Request,{params}:any){
 try{const index=Number(new URL(request.url).searchParams.get('index')||0);if(!Number.isInteger(index)||index<0||index>=8)return new Response(null,{status:404,headers:privateHeaders});const id=(await params).id,owner=await productOwner(request,id);const row=owner?await getAdhoc(id,owner):null;if(!row||!env.BUCKET)return new Response(null,{status:404,headers:privateHeaders});const selected=adhocImages(row)[index];if(!selected)return new Response(null,{status:404,headers:privateHeaders});if(selected.url)return new Response(null,{status:302,headers:{...privateHeaders,Location:selected.url}});const object=await env.BUCKET.get(selected.key);if(!object)return new Response(null,{status:404,headers:privateHeaders});return new Response(object.body,{headers:{...privateHeaders,'Content-Type':selected.type,'Content-Security-Policy':"default-src 'none'; sandbox"}});}catch{return new Response(null,{status:503,headers:privateHeaders});}
}
