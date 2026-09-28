import {actor,readQuote} from '@/lib/workspace-access';
import {privateHeaders} from '@/lib/admin-access';
import {orderStatuses,readOrderByPublicId,updateOrderStatus,type OrderStatus} from '@/lib/orders';

const json=(data:unknown,status=200)=>Response.json(data,{status,headers:privateHeaders});

export async function GET(r:Request,{params}:any){
 try{
  const user=await actor(r),id=(await params).id;
  const order=await readOrderByPublicId(id);
  if(!order)return json({error:'Order not found.'},404);
  await readQuote(r,order.quote_id,user);
  return json(order);
 }catch(e){return json({error:e instanceof Error?e.message:'Order could not be loaded.'},403);}
}

export async function PATCH(r:Request,{params}:any){
 if(r.headers.get('origin')!==new URL(r.url).origin)return json({error:'Request origin is not allowed.'},403);
 try{
  const user=await actor(r),id=(await params).id;
  const order=await readOrderByPublicId(id);
  if(!order)return json({error:'Order not found.'},404);
  await readQuote(r,order.quote_id,user);
  if(!user.permissions.createEdit&&!user.permissions.superAdmin)return json({error:'You do not have permission to update orders.'},403);
  const body=await r.json() as {status?:string};
  if(!orderStatuses.includes(body.status as OrderStatus))return json({error:'Choose a valid order status.'},400);
  return json(await updateOrderStatus(id,body.status as OrderStatus));
 }catch(e){return json({error:e instanceof Error?e.message:'Order could not be updated.'},400);}
}
