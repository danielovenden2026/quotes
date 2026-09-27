import QuoteApp from '../../quote-app';
export default async function Page({params}:any){return <QuoteApp initialView="customer" initialId={(await params).id}/>;}
