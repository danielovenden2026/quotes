import {lineKey,type Item,type Quote} from './quote';
import {reanchorBlocks} from './quote-layout';
import type {FeedProduct} from './product-feed';
const key=(sku:string)=>sku.trim().toUpperCase();
// Stable, quote-local UUIDs keep a generated option attached to its own product line.
function optionId(parent:string,sku:string){
 const seed=parent+'\u0000'+key(sku);let hex='';
 for(let n=0;n<4;n++){let h=(2166136261+n*374761393)>>>0;for(let i=0;i<seed.length;i++)h=Math.imul(h^seed.charCodeAt(i),16777619)>>>0;hex+=h.toString(16).padStart(8,'0');}
 return hex.slice(0,8)+'-'+hex.slice(8,12)+'-4'+hex.slice(13,16)+'-a'+hex.slice(17,20)+'-'+hex.slice(20);
}
export function syncAutoOptions(q:Quote,products:FeedProduct[],maxOptions=20):Quote{
 const catalogue=new Map(products.map(p=>[key(p.sku),p]));
 const previous=new Map(q.items.filter(i=>i.autoOptionFor).map(i=>[i.autoOptionFor+'\u0000'+key(i.sku),i]));
 const manual=q.items.filter(i=>!i.autoOptionFor||!i.optional).map(i=>{if(!i.autoOptionFor)return i;const {autoOptionFor,autoOptionSource,...rest}=i;return rest;});
 const automaticLimit=Math.min(Number.isInteger(maxOptions)?Math.max(0,Math.min(50,maxOptions)):20,Math.max(0,50-manual.length));
 let automaticCount=0;
 const items:Item[]=[];
 for(let index=0;index<manual.length;index++){
  const parent=manual[index];items.push(parent);if(parent.optional)continue;
  const options:Item[]=[];
  while(manual[index+1]?.optional){options.push(manual[++index]);}
  items.push(...options);
  if(parent.productSource==='exo'||parent.noAutoOptions||parent.qty===0||((parent.adhocId||parent.custom)&&!parent.sourceSku))continue;
  const source=catalogue.get(key(parent.sourceSku||parent.sku));if(!source)continue;
  const seen=new Set([key(parent.sku),...options.map(i=>key(i.sourceSku||i.sku))]);
  for(const [kind,skus] of [['related',source.relatedSkus||[]],['otherskus',source.otherSkus||[]]] as const){
   for(const sku of skus){const normalized=key(sku);if(seen.has(normalized))continue;seen.add(normalized);
    const product=catalogue.get(normalized);if(!product||automaticCount>=automaticLimit)continue;
    automaticCount++;
    const old=previous.get(lineKey(parent)+'\u0000'+normalized);
    items.push(old?{...old,autoOptionFor:lineKey(parent),autoOptionSource:kind}:{lineId:optionId(lineKey(parent),product.sku),sku:product.sku,name:product.name,price:product.salePrice??product.regularPrice,standardPrice:product.regularPrice,qty:1,baseQty:1,optional:true,selected:false,note:'',image:product.image,url:product.url,autoOptionFor:lineKey(parent),autoOptionSource:kind});
   }
  }
 }
 if(manual.length>50)throw Error('A quote can contain up to 50 manually added lines.');
 return {...q,items,blocks:reanchorBlocks(q,items)};
}
