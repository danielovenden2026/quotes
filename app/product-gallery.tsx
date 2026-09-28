'use client';
import {useState} from 'react';
import {ArrowLeft,ArrowRight,Package} from 'lucide-react';
import type {Item} from '@/lib/quote';
export default function ProductGallery({item}:{item:Item}){
 const images=item.images?.length?item.images:item.image?[item.image]:[];
 const [index,setIndex]=useState(0),[failed,setFailed]=useState<string[]>([]);
 const selected=images[index]||images[0];
 return <div className="product-gallery">
 <div className="gallery-main">{selected&&!failed.includes(selected)?<img src={selected} alt={item.name+' — image '+(index+1)} onError={()=>setFailed(v=>[...v,selected])}/>:<div className="gallery-empty"><Package size={48}/><span>{selected?'Image unavailable':'No image supplied'}</span></div>}</div>
 {images.length>1&&<><div className="gallery-navigation"><button className="btn outline" aria-label="Previous product image" disabled={index===0} onClick={()=>setIndex(i=>i-1)}><ArrowLeft size={16}/></button><span aria-live="polite">Image {index+1} of {images.length}</span><button className="btn outline" aria-label="Next product image" disabled={index===images.length-1} onClick={()=>setIndex(i=>i+1)}><ArrowRight size={16}/></button></div><div className="gallery-thumbnails">{images.map((image,i)=><button key={image} aria-label={'Show product image '+(i+1)} aria-pressed={index===i} onClick={()=>setIndex(i)}><img src={image} alt=""/></button>)}</div></>}
 </div>;
}
