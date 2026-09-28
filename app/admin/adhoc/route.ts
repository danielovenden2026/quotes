import {accessStatus,readQuote} from '@/lib/workspace-access';
import {env} from 'cloudflare:workers';
import {adminAccess,privateHeaders,escapeHtml} from '@/lib/admin-access';
import {getAdhoc,validAdhocId,imageType,adhocImages,safeFeedImage,type AdhocImage} from '@/lib/adhoc-products';
import {getCatalogue} from '@/lib/catalogue-data';
import {normaliseSku} from '@/lib/cost-source';
export const dynamic='force-dynamic';
function result(message:string,status=200){return new Response('<!doctype html><html><head><meta charset="utf-8"><style>body{font:14px Arial;color:#142a3d;margin:8px}</style></head><body>'+escapeHtml(message)+'</body></html>',{status,headers:{...privateHeaders,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'self'; sandbox",'X-Frame-Options':'SAMEORIGIN'}});}
function amount(value:FormDataEntryValue|null,positive=false){const s=String(value??'');if(!/^\d{1,7}(\.\d{1,2})?$/.test(s))throw Error('Enter valid cost and sell prices with up to two decimal places.');const n=Math.round(Number(s)*100);if(n>100000000||(positive&&n<=0))throw Error('Sell price must be greater than zero and prices must be at most $1,000,000.');return n;}
export async function POST(request:Request){
 const access=await accessStatus(request,'createEdit');if(access!==200)return result('Admin access required.',access);
 if(request.headers.get('origin')!==new URL(request.url).origin)return result('Access denied.',403);
 const uploaded:string[]=[];
 try{
  if(!env.DB)throw Error('Product storage unavailable.');
  // Eight 2 MB images plus bounded multipart fields. Enforce the actual stream.
  const reader=request.body?.getReader();if(!reader)throw Error('No product supplied.');
  const chunks:Uint8Array[]=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>17_000_000)throw Error('Upload up to 8 images, no larger than 2 MB each.');chunks.push(value);}}finally{await reader.cancel();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const form=await new Response(bytes,{headers:{'Content-Type':request.headers.get('content-type')||''}}).formData();
  const id=String(form.get('id')||''),quoteId=String(form.get('quoteId')||''),editId=String(form.get('editId')||''),editSku=String(form.get('editSku')||'').trim();
  if(!validAdhocId(id)||editId===id)throw Error('Invalid product reference. Close and reopen the form.');
  const quote=await readQuote(request,quoteId),user=quote.owner;
  if(!quote)throw Error('Quote not found.');
  const q=JSON.parse(quote.data);if(!['Draft','Changes requested'].includes(q.status))throw Error('Create a revision before changing products.');
  const existing=await getAdhoc(id,user);
  if(existing){if(existing.quote_id!==quoteId)throw Error('Product does not belong to this quote.');return result('Product saved.');}
  const original=editId?await getAdhoc(editId,user):null;
  if(editId&&(!original||original.quote_id!==quoteId))throw Error('Custom product not found on this quote.');
  const savedItem=editSku?q.items.find((i:{sku:string})=>normaliseSku(i.sku)===normaliseSku(editSku)&&(!form.get('editLineId')||(i as any).lineId===form.get('editLineId'))):undefined;
  if(editSku&&savedItem?.adhocId)throw Error('This product has already been edited. Reload the quote.');
  const feedItem=editSku?(await getCatalogue()).products.find(i=>normaliseSku(i.sku)===normaliseSku(editSku)):undefined;
  if(editSku&&!feedItem&&!savedItem)throw Error('Product not found. Save the product on this quote first.');
  if(editSku&&editId)throw Error('Invalid product reference.');
  const source=editSku?(savedItem||feedItem):null;
  const sourceSku=original?.source_sku||source?.sku||null;
  const sku=original?.sku||source?.sku||String(form.get('sku')||'').trim(),name=String(form.get('name')||'').trim();
  if(!sku||sku.length>100||!name||name.length>250)throw Error('Enter a SKU and product name.');
  const key=normaliseSku(sku);
  if(!original&&!source){
   if(q.items.length>=50)throw Error('This quote has reached its 50-product limit.');
   if(q.items.some((i:{sku:string})=>normaliseSku(i.sku)===key)||(await getCatalogue()).products.some(i=>normaliseSku(i.sku)===key))throw Error('This SKU already exists. Use a unique custom SKU.');
  }
  const keepCost=String(form.get('cost')||'').trim()==='';
  const costFromFeed=keepCost&&(original?original.cost_from_feed===1:!!source);
  const cost=costFromFeed?0:keepCost&&original?original.cost:amount(form.get('cost')),price=original?.price??source?.standardPrice??feedItem?.regularPrice??source?.price??amount(form.get('price'),true),qty=original?.qty??source?.qty??Number(form.get('qty'));
  if(!Number.isInteger(qty)||qty<1||qty>10000)throw Error('Quantity must be between 1 and 10,000.');
  const sourceImages=(source?.images||(source?.image?[source.image]:feedItem?.image?[feedItem.image]:[])) as string[];
  const priorImages:AdhocImage[]=original?adhocImages(original):sourceImages.flatMap(url=>safeFeedImage(url)?[{key:'',type:'',url:safeFeedImage(url)!}]:[]);
  const keep=form.getAll('keepImage').map(String);
  if(keep.some(i=>!/^\d+$/.test(i)||Number(i)>=priorImages.length)||new Set(keep).size!==keep.length)throw Error('Invalid image selection. Reopen the editor.');
  const images:AdhocImage[]=priorImages.filter((_,i)=>keep.includes(String(i)));
  const files=[...form.getAll('images'),...form.getAll('image')].filter((f):f is File=>f instanceof File&&f.size>0);
  if(images.length+files.length>8)throw Error('Keep or upload no more than 8 images per product.');
  const newImages=await Promise.all(files.map(async file=>{if(file.size>2097152)throw Error('Each image must be smaller than 2 MB.');const data=new Uint8Array(await file.arrayBuffer()),type=imageType(data);if(!type)throw Error('Choose PNG, JPEG or WebP images.');return {data,type};}));
  if(newImages.length&&!env.BUCKET)throw Error('Image storage is unavailable. Please try again shortly.');
  for(const image of newImages){const key='adhoc/'+crypto.randomUUID();uploaded.push(key);await env.BUCKET!.put(key,image.data,{httpMetadata:{contentType:image.type}});images.push({key,type:image.type});}
  // Edits produce a new immutable record: existing saved quotes/revisions keep
  // their original cost and image references until this new item is saved.
  await env.DB.prepare('INSERT INTO adhoc_products (id,owner,quote_id,sku,name,cost,price,qty,image_key,image_type,created,images_json,family_id,source_sku,cost_from_feed) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,user,quoteId,sku,name,cost,price,qty,images[0]?.key||null,images[0]?.type||null,new Date().toISOString(),JSON.stringify(images),original?(original.family_id||original.id):id,sourceSku,costFromFeed?1:0).run();
  uploaded.length=0;return result('Product saved. Save the quote to keep your changes.');
 }catch(error){if(env.BUCKET)await Promise.all(uploaded.map(key=>env.BUCKET!.delete(key).catch(()=>{})));return result(error instanceof Error?error.message:'Unable to save product. Please try again.',400);}
}
