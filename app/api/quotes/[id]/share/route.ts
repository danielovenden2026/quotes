import {requirePermission,readQuote} from '@/lib/workspace-access';
import {privateHeaders} from '@/lib/admin-access';
import {createOrEnableShareToken,revokeShareToken,shareTokenForQuote} from '@/lib/public-quote';

const json=(data:unknown,status=200)=>Response.json(data,{status,headers:privateHeaders});

export async function GET(r:Request,{params}:any){
 try{
  const user=await requirePermission(r,'sendQuotes'),id=(await params).id;
  await readQuote(r,id,user);
  const token=await shareTokenForQuote(id);
  return json({token,active:!!token});
 }catch(e){return json({error:e instanceof Error?e.message:'Share link could not be loaded.'},403);}
}

export async function POST(r:Request,{params}:any){
 if(r.headers.get('origin')!==new URL(r.url).origin)return json({error:'Request origin is not allowed.'},403);
 try{
  const user=await requirePermission(r,'sendQuotes'),id=(await params).id;
  const record=await readQuote(r,id,user);
  if(!['Ready','Accepted'].includes(record.quote.status))return json({error:'Approve the quote before creating a customer link.'},409);
  const token=await createOrEnableShareToken(id,user.email);
  return json({token,active:true});
 }catch(e){return json({error:e instanceof Error?e.message:'Share link could not be created.'},400);}
}

export async function DELETE(r:Request,{params}:any){
 if(r.headers.get('origin')!==new URL(r.url).origin)return json({error:'Request origin is not allowed.'},403);
 try{
  const user=await requirePermission(r,'sendQuotes'),id=(await params).id;
  await readQuote(r,id,user);await revokeShareToken(id);return json({active:false});
 }catch(e){return json({error:e instanceof Error?e.message:'Share link could not be revoked.'},400);}
}
