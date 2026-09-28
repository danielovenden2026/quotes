import {identityActor} from '@/lib/workspace-access';
import {verificationStatus,sendCode,checkCode} from '@/lib/two-factor';
import {privateHeaders} from '@/lib/admin-access';
import {safeRequest} from '@/lib/store';
import {z} from 'zod';
export async function GET(r:Request){try{return Response.json(await verificationStatus(await identityActor(r)),{headers:privateHeaders});}catch{return Response.json({error:'Sign in with an enabled workspace account.'},{status:403,headers:privateHeaders});}}
export async function POST(r:Request){try{safeRequest(r);if(!r.headers.get('content-type')?.startsWith('application/json'))throw Error('Invalid request.');const raw=await r.text();if(raw.length>1000)throw Error('Invalid request.');const user=await identityActor(r),body=z.discriminatedUnion('action',[z.object({action:z.literal('send'),channel:z.enum(['email','sms'])}),z.object({action:z.literal('verify'),code:z.string().max(10)})]).parse(JSON.parse(raw));if(body.action==='send')return Response.json(await sendCode(user,body.channel),{headers:privateHeaders});const cookie=await checkCode(user,body.code);return Response.json({verified:true},{headers:{...privateHeaders,'Set-Cookie':cookie}});}catch(e){return Response.json({error:e instanceof Error?e.message:'Verification failed.'},{status:400,headers:privateHeaders});}}
