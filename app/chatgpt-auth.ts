import {headers} from 'next/headers';
import {redirect} from 'next/navigation';
import {sessionIdentityFromCookie} from '@/lib/password-auth';
export type ChatGPTUser={userId:string;displayName:string;email:string;fullName:string|null};
export async function getChatGPTUser():Promise<ChatGPTUser|null>{const requestHeaders=await headers(),session=await sessionIdentityFromCookie(requestHeaders.get('cookie'));return session?{userId:session.id,displayName:session.name,email:session.email,fullName:session.name}:null;}
export async function requireChatGPTUser(returnTo:string):Promise<ChatGPTUser>{const user=await getChatGPTUser();if(user)return user;redirect('/login?returnTo='+encodeURIComponent(safeRelativeReturnPath(returnTo)));}
export function chatGPTSignInPath(returnTo:string){return '/login?returnTo='+encodeURIComponent(safeRelativeReturnPath(returnTo));}
export function chatGPTSignOutPath(){return '/logout';}
function safeRelativeReturnPath(value:string){if(!value.startsWith('/')||value.startsWith('//'))return '/';let url:URL;try{url=new URL(value,'https://app.local');}catch{return '/';}if(url.origin!=='https://app.local')return '/';return `${url.pathname}${url.search}${url.hash}`;}
