'use client';
import {useState,type ReactNode} from 'react';
import {Checkbox} from '@/components/ui/checkbox';
import ProductNote from './product-note';
import type {Item} from '@/lib/quote';

export default function DemoProductForm({item,currentCost,onAdded}:{item:Item;currentCost:ReactNode;onAdded:(item:Item,newUrls:string[])=>void}){
 const previous=item.images||(item.image?[item.image]:[]);
 const [keep,setKeep]=useState(()=>previous.map((_,index)=>index));
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 return <form className="adhoc-form" onSubmit={async event=>{
  event.preventDefault();if(busy)return;
  const data=new FormData(event.currentTarget),name=String(data.get('name')||'').trim(),cost=String(data.get('cost')||'').trim();
  const files=data.getAll('images').filter((file):file is File=>file instanceof File&&file.size>0);
  if(!name){setError('Enter a product name.');return;}
  if(keep.length+files.length>8){setError('Keep or upload no more than 8 images.');return;}
  if(files.some(file=>file.size>2097152||!['image/png','image/jpeg','image/webp'].includes(file.type))){setError('Choose PNG, JPEG or WebP images smaller than 2 MB each.');return;}
  const entered=cost===''?undefined:Math.round(Number(cost)*100);
  if(entered!==undefined&&(!Number.isSafeInteger(entered)||entered<0||entered>100000000)){setError('Enter a valid unit cost between $0 and $1,000,000.');return;}
  setBusy(true);setError('');const urls:string[]=[];
  try{
   for(const file of files){const bitmap=await createImageBitmap(file);bitmap.close();urls.push(URL.createObjectURL(file));}
   const images=[...keep.map(index=>previous[index]),...urls];
   onAdded({...item,name,custom:true,sourceSku:item.sourceSku||(!item.custom?item.sku:undefined),images,image:images[0],...(entered===undefined?{}:{demoCost:entered})},urls);
  }catch{urls.forEach(url=>URL.revokeObjectURL(url));setError('One of these images could not be opened. Please choose a valid image.');setBusy(false);}
 }}>
 <div className="form-grid">
 <label className="field"><span>SKU</span><input value={item.sku} readOnly/></label>
 <label className="field"><span>Product name</span><input name="name" required maxLength={250} defaultValue={item.name}/></label>
 <label className="field"><span>New unit cost ($ ex GST)</span><input name="cost" type="number" min="0" max="1000000" step="0.01" placeholder="Leave blank to keep current cost"/></label>
 <div className="field"><span>Current unit cost</span>{currentCost}</div>
 </div>
 <ProductNote note={item.note} plain/>
 {previous.length>0&&<fieldset className="adhoc-image-fieldset"><legend>Current images</legend><p>Untick an image to remove it from this test copy.</p><div className="adhoc-image-options">{previous.map((image,index)=><label key={index}><img src={image} alt={'Product image '+(index+1)}/><span><Checkbox checked={keep.includes(index)} onCheckedChange={checked=>setKeep(current=>checked?[...current,index].sort((a,b)=>a-b):current.filter(i=>i!==index))}/>Keep image {index+1}</span></label>)}</div></fieldset>}
 <label className="field adhoc-image-upload"><span>Add more images</span><input name="images" type="file" multiple accept="image/png,image/jpeg,image/webp"/><small>Up to 8 images in total · Maximum 2 MB each.</small></label>
 <p className="dialog-note">Changes and images stay in this demo tab and reset on refresh. Apply changes, then save the draft.</p>
 {error&&<p role="alert" className="price-warning">{error}</p>}
 <button className="btn primary full" type="submit" disabled={busy}>{busy?'Applying…':'Apply product changes'}</button>
 </form>;
}
