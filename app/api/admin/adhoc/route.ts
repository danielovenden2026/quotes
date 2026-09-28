import {accessStatus,productOwner} from '@/lib/workspace-access';
import {env} from 'cloudflare:workers';
import {adminAccess,privateHeaders} from '@/lib/admin-access';
import {getAdhoc,publicAdhoc} from '@/lib/adhoc-products';
export async function GET(request:Request){
 const access=await accessStatus(request,'createEdit');if(access!==200)return Response.json({error:'Admin access required'},{status:access,headers:privateHeaders});
 try{const id=new URL(request.url).searchParams.get('id')||'',owner=await productOwner(request,id);const row=owner?await getAdhoc(id,owner):null;return Response.json(row?{item:publicAdhoc(row)}:{error:'Product not added'},{status:row?200:404,headers:privateHeaders});}catch{return Response.json({error:'Product unavailable'},{status:503,headers:privateHeaders});}
}
