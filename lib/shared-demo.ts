import {cleanNote} from './quote-layout';
import {newQuote,type Quote,type Item} from './quote';
// Project only the quote details authorised for this demo. Never copy private
// history, approval identities, ad hoc record IDs, or arbitrary future fields.
function publicUrl(value:string|undefined,image=false):string|undefined{
 try{const url=new URL(value||'');if(url.protocol!=='https:'||url.username||url.password)return;
 if(!['verdex.com.au','www.verdex.com.au'].includes(url.hostname))return;
 if(/\/(admin|backend)(\/|$)/i.test(url.pathname)||url.search||url.hash)return;
 if(image&&!url.pathname.startsWith('/media/'))return;
 return url.href;
 }catch{return;}
}
export function sharedDemoQuote(q:Quote,demoPath='/demo/vq-ecbe1bd3'):Quote{
 // An authorised sample quote may later be reused for a real CRM contact.
 // Never publish that contact's imported details through the saved demo route.
 if(q.hubspotContactId){const sample=newQuote(true);q={...q,company:sample.company,contact:sample.contact,email:sample.email,address:sample.address,suburb:sample.suburb,state:sample.state,postcode:sample.postcode,reference:'',vendorNumber:'',customerTerms:'',po:'',instructions:''};}
 const items:Item[]=q.items.map(i=>({productSource:i.productSource,exoDescriptionHtml:i.exoDescriptionHtml,noAutoOptions:i.noAutoOptions,autoOptionFor:i.autoOptionFor,autoOptionSource:i.autoOptionSource,lineId:i.lineId,sourceSku:i.sourceSku,sku:i.sku,name:i.name,price:i.price,discount:i.discount,standardPrice:i.standardPrice,qty:i.qty,baseQty:i.baseQty,optional:i.optional,selected:i.selected,note:i.note,...(i.adhocId?{custom:true,images:(i.images|| (i.image?[i.image]:[])).map((_,index)=>demoPath+'/images?sku='+encodeURIComponent(i.sku)+(i.lineId?'&lineId='+encodeURIComponent(i.lineId):'')+'&index='+index),image:(i.images?.length||i.image)?demoPath+'/images?sku='+encodeURIComponent(i.sku)+(i.lineId?'&lineId='+encodeURIComponent(i.lineId):'')+'&index=0':undefined}:{image:publicUrl(i.image,true),images:i.images?.map(image=>publicUrl(image,true)).filter((image):image is string=>!!image)}),url:publicUrl(i.url)}));
 return {id:q.id,number:q.number,company:q.company,contact:q.contact,email:q.email,address:q.address,suburb:q.suburb||'',state:q.state||'',postcode:q.postcode||'',title:q.title,reference:q.reference,vendorNumber:q.vendorNumber||'',customerTerms:q.customerTerms||'',date:q.date,expiry:q.expiry,freight:q.freight,handling:q.handling,fulfilmentMethod:q.fulfilmentMethod||'delivery',hidePickup:q.hidePickup===true,hideOwnFreight:q.hideOwnFreight===true,ownFreightNotes:q.ownFreightNotes||'',deliveryNotes:q.deliveryNotes||'',terms:q.terms,status:q.status,revision:q.revision,version:1,items,blocks:(q.blocks||[]).map(b=>({id:b.id,kind:b.kind,beforeSku:b.beforeSku,content:cleanNote(b.content)})),po:q.po,instructions:q.instructions,events:[{at:new Date().toISOString(),text:'Shared test copy opened. Changes apply only to this demo session.'}],snapshots:[]};
}
