'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {Checkbox} from '@/components/ui/checkbox';
import ProductNote from './product-note';
import type {Item} from '@/lib/quote';
export default function AdhocForm({quoteId,items,editing,onAdded}:{quoteId:string;items:Item[];editing?:Item;onAdded:(item:Item)=>void}){
 const frameName='adhoc-result-'+useId().replace(/[^a-zA-Z0-9]/g,'');
 const [id,setId]=useState(''),[submitting,setSubmitting]=useState(false),[error,setError]=useState('');
 const previousImages=editing?.images|| (editing?.image?[editing.image]:[]);
 const [keep,setKeep]=useState(()=>previousImages.map((_,i)=>i));
 const [fileCount,setFileCount]=useState(0);
 useEffect(()=>{const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');setId([hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-'));},[]);
 const pending=useRef(false),added=useRef(false);
 async function finished(){
  if(!pending.current||added.current)return;
  try{const r=await fetch('/api/admin/adhoc?id='+id,{cache:'no-store'});if(r.ok){const data=await r.json() as {item:Item};added.current=true;onAdded(data.item);}else setError('Product was not saved. Check the message below, then try again.');}
  catch{setError('Could not confirm the product. Try saving again; it will not create a duplicate.');}
  finally{pending.current=false;setSubmitting(false);}
 }
 return <form action="/admin/adhoc" method="post" encType="multipart/form-data" target={frameName} onSubmit={e=>{
  // Cost posts directly to the server; it never enters React state or JSON.
  const sku=(e.currentTarget.elements.namedItem('sku') as HTMLInputElement).value.trim().toUpperCase();
  if(!editing&&(items.some(i=>i.sku.trim().toUpperCase()===sku)||items.length>=50)){e.preventDefault();setError(items.length>=50?'The quote has reached its 50-product limit.':'This SKU is already on the quote.');return;}
  if(keep.length+fileCount>8){e.preventDefault();setError('Keep or upload no more than 8 images.');return;}
  if(pending.current){e.preventDefault();return;}pending.current=true;setSubmitting(true);setError('');
 }} className="adhoc-form">
 {editing?.lineId&&<input type="hidden" name="editLineId" value={editing.lineId}/>}
 <input type="hidden" name="quoteId" value={quoteId}/><input type="hidden" name="id" value={id}/>
 {editing?.adhocId?<input type="hidden" name="editId" value={editing.adhocId}/>:editing?<input type="hidden" name="editSku" value={editing.sku}/>:null}
 {keep.map(index=><input key={index} type="hidden" name="keepImage" value={index}/>)}
 <div className="form-grid">
 <label className="field"><span>{editing?'SKU':'Custom SKU'}</span><input name="sku" required maxLength={100} defaultValue={editing?.sku} readOnly={!!editing} placeholder="e.g. CUSTOM-001"/></label>
 <label className="field"><span>Product name</span><input name="name" required maxLength={250} defaultValue={editing?.name}/></label>
 <label className="field"><span>{editing?'New unit cost ($ ex GST)':'Unit cost ($ ex GST)'}</span><input name="cost" required={!editing} type="number" min="0" max="1000000" step="0.01" autoComplete="off" placeholder={editing?'Leave blank to keep current cost':undefined}/></label>
 {editing?<div className="field"><span>Current unit cost</span><iframe title="Current product unit cost" src={'/admin/unit-cost?sku='+encodeURIComponent(editing.sku)+(editing.adhocId?'&adhocId='+encodeURIComponent(editing.adhocId):'')} sandbox="" referrerPolicy="no-referrer" className="unit-cost-frame"/></div>:<><label className="field"><span>Sell price ($ ex GST)</span><input name="price" required type="number" min="0.01" max="1000000" step="0.01"/></label><label className="field"><span>Quantity</span><input name="qty" required type="number" min="1" max="10000" step="1" defaultValue="1"/></label></>}
 </div>
 <ProductNote note={editing?.note} plain/>
 {previousImages.length>0&&<fieldset className="adhoc-image-fieldset"><legend>Current images</legend><p>Untick an image to remove it from this version.</p><div className="adhoc-image-options">{previousImages.map((image,index)=><label key={image}><img src={image} alt={'Product image '+(index+1)}/><span><Checkbox checked={keep.includes(index)} onCheckedChange={checked=>setKeep(current=>checked?[...current,index]:current.filter(i=>i!==index))}/>Keep image {index+1}</span></label>)}</div></fieldset>}
 <label className="field adhoc-image-upload"><span>{editing?'Add more images':'Product images (optional)'}</span><input name="images" type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={e=>{const files=Array.from(e.target.files||[]);setFileCount(files.length);setError(files.some(file=>file.size>2097152)?'Each image must be smaller than 2 MB.':'');}}/><small>Up to 8 images in total · PNG, JPEG or WebP · Maximum 2 MB each. The first kept image is the thumbnail.</small></label>
 <p className="dialog-note">{editing?'Save the quote after applying your changes. Quoted price, quantity and product notes are kept.':'Unit cost is visible only to users with cost and GP permission. The sell price becomes the starting quoted and standard price for this custom item.'}</p>
 {error&&<p role="alert" className="price-warning">{error}</p>}
 <iframe name={frameName} title="Product submission result" sandbox="" onLoad={finished} className={'adhoc-result '+(submitting||error?'':'empty')}/>
 <button className="btn primary full" type="submit" disabled={submitting||!id}>{submitting?'Saving product…':editing?'Apply product changes':'Add to quote'}</button>
 </form>;
}
