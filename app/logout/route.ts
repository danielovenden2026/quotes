import {destroySession} from '@/lib/password-auth';
export async function GET(request:Request){const headers=new Headers({'Location':new URL('/login',request.url).toString(),'Cache-Control':'no-store'});headers.append('Set-Cookie',await destroySession(request.headers.get('cookie')));return new Response(null,{status:303,headers});}
