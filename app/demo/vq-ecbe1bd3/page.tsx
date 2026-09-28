import QuoteApp from '../../quote-app';
import {db} from '@/lib/store';
import {sharedDemoQuote} from '@/lib/shared-demo';
import type {Quote} from '@/lib/quote';
export const dynamic='force-dynamic';
export const metadata={title:'VQ-ECBE1BD3 — Verdex shared demo',robots:{index:false,follow:false}};
export default async function SharedQuoteDemo(){
 // This exact quote was explicitly authorised for a public demo. This is not
 // a parameterised lookup: other saved quotes remain private.
 let quote:Quote|undefined;
 try{const row=await db().prepare('SELECT data FROM quotes WHERE id=?').bind('ecbe1bd3-9939-4a26-8c74-a6804110f4b7').first<{data:string}>();if(row){const source=JSON.parse(row.data) as Quote;if(source.number==='VQ-ECBE1BD3')quote=sharedDemoQuote(source);}}catch{/* Do not expose storage errors. */}
 if(!quote)return <main className="page-shell"><h1>Demo quote unavailable</h1><p>This quotation could not be loaded. Please try again shortly.</p></main>;
 return <QuoteApp initialView="customer" sharedDemo liveDemoData demoQuote={quote}/>;
}
