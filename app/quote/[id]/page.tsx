import QuoteApp from '../../quote-app';
import {getChatGPTUser,chatGPTSignInPath} from '../../chatgpt-auth';
import {shareTokenForQuote} from '@/lib/public-quote';
import {redirect} from 'next/navigation';
export const dynamic='force-dynamic';

export default async function Page({params}:any){
 const id=(await params).id;
 const user=await getChatGPTUser();
 if(user)return <QuoteApp initialView="customer" initialId={id}/>;
 const token=await shareTokenForQuote(id);
 if(token)redirect('/q/'+token);
 redirect(chatGPTSignInPath('/quote/'+encodeURIComponent(id)));
}
