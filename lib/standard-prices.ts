import {lineKey,type Quote} from './quote';
import {getCatalogue} from './catalogue-data';

// Use trusted saved/catalogue values, never customer-submitted price metadata.
export async function withStandardPrices(quote:Quote,previous?:Quote):Promise<Quote>{
 const prior=new Map(previous?.items.map(i=>[lineKey(i),i])??[]);
 const items=quote.items.map(i=>({...i,standardPrice:i.adhocId||i.productSource==='exo'?i.standardPrice:previous?prior.get(lineKey(i))?.standardPrice:i.standardPrice}));
 if(items.every(i=>i.standardPrice!==undefined))return {...quote,items};
 const catalogue=await getCatalogue();
 const prices=new Map(catalogue.products.map(p=>[p.sku,p.regularPrice]));
 return {...quote,items:items.map(i=>{const cataloguePrice=i.productSource==='exo'?undefined:prices.get(i.sku);return {...i,standardPrice:i.standardPrice??((cataloguePrice??0)>0?cataloguePrice!:i.price)};})};
}
