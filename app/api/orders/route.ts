import {actor} from '@/lib/workspace-access';
import {privateHeaders} from '@/lib/admin-access';
import {listOrders} from '@/lib/orders';

export async function GET(r:Request){
 try{
  const user=await actor(r);
  return Response.json(await listOrders(user.id,user.permissions.viewTeam),{headers:privateHeaders});
 }catch(e){
  return Response.json({error:e instanceof Error?e.message:'Orders could not be loaded.'},{status:403,headers:privateHeaders});
 }
}
