'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';

export default function StaffTableScroll({children}:{children:ReactNode}){
 const root=useRef<HTMLDivElement>(null),top=useRef<HTMLDivElement>(null);
 const [width,setWidth]=useState(0),[overflow,setOverflow]=useState(false);
 useEffect(()=>{
  const viewport=root.current?.querySelector<HTMLElement>('[data-slot="table-container"]');
  const table=viewport?.querySelector('table');
  const scrollbar=top.current;
  if(!viewport||!table||!scrollbar)return;
  viewport.tabIndex=0;viewport.setAttribute('role','region');viewport.setAttribute('aria-label','Quote items, scroll horizontally for more columns');
  const measure=()=>{setWidth(viewport.scrollWidth);setOverflow(viewport.scrollWidth>viewport.clientWidth+1);scrollbar.scrollLeft=viewport.scrollLeft;};
  const fromTop=()=>{if(Math.abs(viewport.scrollLeft-scrollbar.scrollLeft)>1)viewport.scrollLeft=scrollbar.scrollLeft;};
  const fromTable=()=>{if(Math.abs(scrollbar.scrollLeft-viewport.scrollLeft)>1)scrollbar.scrollLeft=viewport.scrollLeft;};
  const observer=new ResizeObserver(measure);observer.observe(viewport);observer.observe(table);measure();
  scrollbar.addEventListener('scroll',fromTop);viewport.addEventListener('scroll',fromTable);
  return()=>{observer.disconnect();scrollbar.removeEventListener('scroll',fromTop);viewport.removeEventListener('scroll',fromTable);};
 },[]);
 return <div ref={root} className="staff-table-scroll">
  <div ref={top} className="staff-table-top-scroll" hidden={!overflow} tabIndex={0} role="region" aria-label="Scroll quote columns horizontally"><div style={{width,height:1}}/></div>
  {children}
 </div>;
}
