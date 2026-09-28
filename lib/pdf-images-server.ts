import 'server-only';
import {env} from 'cloudflare:workers';
import {adhocImages,getAdhoc} from './adhoc-products';
import {collectPdfImages,fetchPublicPdfImage,MAX_PDF_IMAGE_BYTES} from './pdf-images';
import {getCatalogue} from './catalogue-data';
import type {Quote} from './quote';
export async function serverPdfImages(q:Quote,user:string){
 const missing=q.items.some(i=>(!i.optional||i.selected)&&i.qty>0&&!i.adhocId&&!i.image&&!i.images?.length);
 const catalogue=missing?(await getCatalogue()).products:[];
 return collectPdfImages(q,async(item,signal)=>{
  if(item.adhocId){
   const record=await getAdhoc(item.adhocId,user);if(!record)return null;
   const image=adhocImages(record)[0];if(!image)return null;
   if(image.url)return fetchPublicPdfImage(image.url,signal);
   const object=await env.BUCKET?.get(image.key);if(!object||object.size>MAX_PDF_IMAGE_BYTES)return null;
   return new Uint8Array(await object.arrayBuffer());
  }
  return fetchPublicPdfImage(item.image||item.images?.[0]||catalogue.find(p=>p.sku.trim().toUpperCase()===item.sku.trim().toUpperCase())?.image||'',signal);
 });
}
