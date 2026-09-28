import QuoteApp from '../../quote-app';
import { requireChatGPTUser } from '../../chatgpt-auth';
export const dynamic = 'force-dynamic';
async function SignedInQuote({id}:{id:string}){
  await requireChatGPTUser('/quote/'+encodeURIComponent(id));
  return <QuoteApp initialView="customer" initialId={id}/>;
}
export default async function Page({params}:any){
  return <SignedInQuote id={(await params).id}/>;
}
