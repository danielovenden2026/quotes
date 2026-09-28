import QuoteApp from '../../quote-app';
export const dynamic='force-dynamic';
export default async function Page({params}:any){
 const token=(await params).token;
 return <QuoteApp initialView="customer" publicToken={token}/>;
}
