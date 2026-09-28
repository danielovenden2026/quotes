import {netUnitPrice} from './line-pricing';
import {needsReview,type Quote} from './quote';
export type FreightRate={carrierCode:string;methodCode:string;label:string;amount:number};
export type FreightEstimate={fingerprint:string;carrierCode:string;methodCode:string;label:string;amount:number;calculatedAt:string};
export function freightInput(q:Pick<Quote,'items'|'address'|'suburb'|'state'|'postcode'>){return {address:q.address.trim(),suburb:(q.suburb||'').trim(),state:(q.state||'').trim(),postcode:(q.postcode||'').trim(),items:q.items.filter(i=>(!i.optional||i.selected)&&i.qty>0).map(i=>({sku:(i.sourceSku||i.sku).trim(),qty:i.qty,price:netUnitPrice(i),custom:!!((i.adhocId||i.custom)&&!i.sourceSku)}))};}
// Rate validity follows the physical shipment, not quoted prices or discounts.
function shipmentKey(input:ReturnType<typeof freightInput>){return JSON.stringify({address:input.address,suburb:input.suburb,state:input.state,postcode:input.postcode,items:input.items.map(({sku,qty,custom})=>({sku,qty,custom})).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))});}
export function freightFingerprint(q:Pick<Quote,'items'|'address'|'suburb'|'state'|'postcode'>){return shipmentKey(freightInput(q));}
function savedShipmentKey(fingerprint:string){
 // Existing saved estimates included price. Compare their shipment fields so a
 // price edit (or this upgrade) does not invalidate an otherwise current rate.
 try{const input=JSON.parse(fingerprint);if(!input||!['address','suburb','state','postcode'].every(k=>typeof input[k]==='string')||!Array.isArray(input.items)||!input.items.every((i:any)=>i&&typeof i.sku==='string'&&Number.isFinite(i.qty)&&typeof i.custom==='boolean'))return null;return shipmentKey(input);}catch{return null;}
}
export function freightNeedsRefresh(q:Quote){return !!q.freightEstimate&&(q.fulfilmentMethod||'delivery')==='delivery'&&(savedShipmentKey(q.freightEstimate.fingerprint)!==freightFingerprint(q)||q.freightEstimate.amount!==q.freight);}

// Recover only the former automatic freight-only hold, never a sales edit or price hold.
export function isFreightOnlyHold(q:Quote){const last=q.events.at(-1),snapshot=q.snapshots.at(-1);return q.status==='Changes requested'&&!needsReview(q)&&freightNeedsRefresh(q)&&snapshot?.quote?.status==='Ready'&&snapshot.revision===q.revision-1&&!!last&&/^Customer (updated quantities without approval; quoted unit prices retained|saved selections and fulfilment details); calculated delivery freight needs review(?:;|$)/.test(last.text);}
