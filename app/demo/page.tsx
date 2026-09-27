import QuoteApp from '../quote-app';
export const metadata={title:'Verdex Quotes — shared demo',description:'Try the Verdex quote experience with ABC Company and sample products.'};
export default function DemoPage(){return <QuoteApp initialView="customer" sharedDemo/>;}
