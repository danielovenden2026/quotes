import {destroySession} from '@/lib/password-auth';
import {privateHeaders} from '@/lib/admin-access';
export async function POST(request:Request){
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'Request origin is not allowed.'},{status:403,headers:privateHeaders});
 return Response.json({ok:true},{headers:{...privateHeaders,'Set-Cookie':await destroySession(request.headers.get('cookie'))}});
}
