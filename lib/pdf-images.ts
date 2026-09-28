import {lineKey,type Quote,type Item} from './quote';
export type PdfImages=Map<string,Uint8Array>;
export const MAX_PDF_IMAGE_BYTES=2_000_000;
// Only the public Magento product-image directory may be fetched remotely.
export function publicPdfImageUrl(raw:string):string|null{
 try{const u=new URL(raw);return u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&['www.verdex.com.au','verdex.com.au'].includes(u.hostname)&&(u.pathname.startsWith('/media/catalog/product/')||/^\/media\/image_resizer\/cache\/[a-f0-9]+\/catalog\/product\//i.test(u.pathname))&&!u.search&&!u.hash?u.href:null;}catch{return null;}
}
export function pdfImageType(b:Uint8Array):'png'|'jpg'|null{
 if(b.length<24||b.length>MAX_PDF_IMAGE_BYTES)return null;
 if([137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v)){
  const v=new DataView(b.buffer,b.byteOffset,b.byteLength),w=v.getUint32(16),h=v.getUint32(20);
  return w>0&&h>0&&w*h<=8_000_000?'png':null;
 }
 if(b[0]!==255||b[1]!==216)return null;
 for(let p=2;p+9<b.length;){if(b[p++]!==255)continue;const marker=b[p++];if(marker===218||marker===217)break;if(marker===216||(marker>=208&&marker<=215))continue;const size=b[p]*256+b[p+1];if(size<2||p+size>b.length)break;if([192,193,194].includes(marker)){const h=b[p+3]*256+b[p+4],w=b[p+5]*256+b[p+6];return w>0&&h>0&&w*h<=8_000_000?'jpg':null;}p+=size;}
 return null;
}
export async function readPdfImage(response:Response):Promise<Uint8Array|null>{
 if(!response.ok||!response.body)return null;
 if(Number(response.headers.get('content-length'))>MAX_PDF_IMAGE_BYTES){await response.body.cancel();return null;}
 const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_PDF_IMAGE_BYTES){await reader.cancel();return null;}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return pdfImageType(bytes)?bytes:null;
}
export async function fetchPublicPdfImage(raw:string,signal?:AbortSignal){
 let url=publicPdfImageUrl(raw);if(!url)return null;
 const timeout=signal||AbortSignal.timeout(12000);
 try{
  for(let redirects=0;redirects<=3;redirects++){
   // Workers support manual/follow only. Validate every redirect before fetching it.
   const response:Response=await fetch(url,{signal:timeout,redirect:'manual',headers:{Accept:'image/jpeg, image/png'}});
   if([301,302,303,307,308].includes(response.status)){
    const location:string|null=response.headers.get('location');await response.body?.cancel();
    url=location?publicPdfImageUrl(new URL(location,url).href):null;if(!url)return null;
    continue;
   }
   return readPdfImage(response);
  }
 }catch{/* An unavailable image does not prevent downloading the quote. */}
 return null;
}
export async function collectPdfImages(q:Quote,read:(item:Item,signal:AbortSignal)=>Promise<Uint8Array|null>):Promise<PdfImages>{
 const images:PdfImages=new Map(),items=q.items.filter(i=>(!i.optional||i.selected)&&i.qty>0).slice(0,50);let next=0,total=0;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
 try{await Promise.all(Array.from({length:4},async()=>{while(next<items.length&&!controller.signal.aborted&&total<16_000_000){const item=items[next++];try{const bytes=await read(item,controller.signal);if(bytes&&pdfImageType(bytes)&&total+bytes.length<=16_000_000){total+=bytes.length;images.set(lineKey(item),bytes);}}catch{/* A missing image must not prevent downloading a quote. */}}}));}finally{clearTimeout(timer);controller.abort();}return images;
}
export async function browserPdfImages(q:Quote):Promise<PdfImages>{
 return collectPdfImages(q,async(item,signal)=>{
  const source=item.image||item.images?.[0];if(!source)return null;
  const remote=publicPdfImageUrl(source);
  // Customer-safe local image routes retain their existing access checks.
  const local=/^\/(api\/product-images\/[a-f0-9-]+|demo\/vq-[a-f0-9]+\/images)(?:\?[^#]*)?$/i.test(source);
  if(!remote&&!local&&!source.startsWith('blob:'))return null;
  return readPdfImage(await fetch(remote?'/api/catalogue/thumbnail?image='+encodeURIComponent(remote):source,{signal,redirect:'error'}));
 });
}
