import type {Quote} from './quote';
import {getCatalogue} from './catalogue-data';

// Use trusted saved/catalogue values, never customer-submitted price metadata.
export async function withStandardPrices(quote:Quote,previous?:Quote):Promise<Quote>{
 const prior=new Map(previous?.items.map(i=>[i.sku,i])??[]);
 const items=quote.items.map(i=>({...i,standardPrice:previous?prior.get(i.sku)?.standardPrice:i.standardPrice}));
 if(items.every(i=>i.standardPrice!==undefined))return {...quote,items};
 const catalogue=await getCatalogue();
 const prices=new Map(catalogue.products.map(p=>[p.sku,p.regularPrice]));
 return {...quote,items:items.map(i=>({...i,standardPrice:i.standardPrice??((prices.get(i.sku)??0)>0?prices.get(i.sku)!:i.price)}))};
}
