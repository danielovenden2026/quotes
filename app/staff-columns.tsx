'use client';
import {useEffect,useRef,useState} from 'react';
import {Columns3,Save} from 'lucide-react';
import {toast} from 'sonner';
import {Checkbox} from '@/components/ui/checkbox';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';

export const staffColumns=[
 {id:'reorder',label:'Reorder',width:36,minWidth:32},
 {id:'product',label:'Product',width:300,minWidth:220},
 {id:'prices',label:'Prices',width:190,minWidth:180},
 {id:'noAutoOptions',label:'No auto options',width:110,minWidth:95},
 {id:'qty',label:'Qty',width:70,minWidth:60},
 {id:'quoted',label:'Quoted Price',width:120,minWidth:105},
 {id:'discount',label:'Discount',width:160,minWidth:150},
 {id:'gp',label:'Line GP%',width:90,minWidth:80},
 {id:'optional',label:'Optional',width:85,minWidth:80},
 {id:'total',label:'Total',width:120,minWidth:105},
 {id:'stock',label:'Stock',width:140,minWidth:125},
] as const;
type ColumnId=typeof staffColumns[number]['id'];
type Layout={version:5;hidden:ColumnId[];widths:Record<ColumnId,number>};
const defaults=():Layout=>({version:5,hidden:[],widths:Object.fromEntries(staffColumns.map(c=>[c.id,c.width])) as Layout['widths']});
const storageKey='verdex.sales-table.v5';
const legacyWidths:Record<ColumnId,number>={discount:9,noAutoOptions:6,reorder:6,product:19,stock:6,prices:9,qty:6,quoted:9,gp:7,optional:6,total:12};
function restore(value:unknown):Layout{
 const result=defaults();
 if(!value||typeof value!=='object')return result;
 const saved=value as {version?:number;hidden?:string[];widths?:Partial<Record<ColumnId,number>>};
 if(saved.version!==1&&saved.version!==2&&saved.version!==3&&saved.version!==4&&saved.version!==5)return result;
 result.hidden=staffColumns.filter(c=>c.id!=='product'&&Array.isArray(saved.hidden)&&saved.hidden.includes(c.id)).map(c=>c.id);
 if((saved.version===1||saved.version===2)&&['totalStock','committedStock','sydney','brisbane','melbourne'].every(id=>saved.hidden?.includes(id)))result.hidden.push('stock');
 if(saved.version<4&&Array.isArray(saved.hidden)&&['standard','sale','saleEnd','cost'].every(id=>saved.hidden?.includes(id)))result.hidden.push('prices');
 for(const c of staffColumns){const width=saved.widths?.[c.id];if(typeof width==='number'&&Number.isFinite(width)&&width>0){const pixels=saved.version===1?width/legacyWidths[c.id]*c.width:saved.version<5&&c.id==='prices'?width*220/275:saved.version<5&&c.id==='stock'?width*185/230:width;result.widths[c.id]=Math.round(Math.max(c.minWidth,Math.min(800,pixels)));}}
 return result;
}

export function useStaffColumns(allowGp=true){
 const [layout,setLayout]=useState<Layout>(defaults),[saved,setSaved]=useState<Layout>(defaults),[ready,setReady]=useState(false);
 const [open,setOpen]=useState(false);
 const drag=useRef<{id:ColumnId;x:number;tableWidth:number;total:number;left:number}|null>(null);
 useEffect(()=>{try{const value=restore(JSON.parse(localStorage.getItem(storageKey)||localStorage.getItem('verdex.sales-table.v4')||localStorage.getItem('verdex.sales-table.v3')||localStorage.getItem('verdex.sales-table.v2')||localStorage.getItem('verdex.sales-table.v1')||'null'));setLayout(value);setSaved(value);}catch{/* Unavailable or malformed storage leaves safe defaults. */}setReady(true);},[]);
 const visible=(id:ColumnId)=>(id!=='gp'||allowGp)&&!layout.hidden.includes(id);
 const columns=staffColumns.filter(c=>visible(c.id));
 const total=columns.reduce((sum,c)=>sum+layout.widths[c.id],0);
 const changed=JSON.stringify(layout)!==JSON.stringify(saved);
 function save(){try{localStorage.setItem(storageKey,JSON.stringify(layout));setSaved(layout);toast.success('Table view saved for this browser');setOpen(false);}catch{toast.error('Your browser could not save this view. Check browser storage settings.');}}
 function setVisible(id:ColumnId,show:boolean){if(id==='product')return;setLayout(v=>({...v,hidden:staffColumns.filter(c=>c.id!==id?v.hidden.includes(c.id):!show).map(c=>c.id)}));}
 function resize(id:ColumnId,width:number){
  const column=staffColumns.find(c=>c.id===id)!;
  setLayout(v=>({...v,widths:{...v.widths,[id]:Math.round(Math.max(column.minWidth,Math.min(800,width)))}}));
 }
 function resizeHandle(id:ColumnId){
  const column=staffColumns.find(c=>c.id===id)!;
  return <span role="separator" tabIndex={0} aria-label={'Resize '+column.label+' column'} aria-orientation="vertical" aria-valuemin={column.minWidth} aria-valuemax={800} aria-valuenow={layout.widths[id]} aria-valuetext={layout.widths[id]+' pixels'} className="column-resizer" title="Drag to resize; use left/right arrow keys when focused" onPointerDown={e=>{
   const table=e.currentTarget.closest('table');if(!table)return;
   e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);
   drag.current={id,x:e.clientX,tableWidth:table.getBoundingClientRect().width,total,left:layout.widths[id]};
  }} onPointerMove={e=>{const d=drag.current;if(d&&d.id===id&&d.tableWidth>0)resize(d.id,d.left+(e.clientX-d.x)/d.tableWidth*d.total);}} onPointerUp={e=>{drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}} onPointerCancel={()=>{drag.current=null;}} onLostPointerCapture={()=>{drag.current=null;}} onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();resize(id,layout.widths[id]+(e.key==='ArrowLeft'?-10:10));}}}/>;
 }
 const controls=<><button className="btn outline" disabled={!ready} onClick={()=>setOpen(true)}><Columns3 size={16}/>Columns</button><button className="btn outline" disabled={!ready||!changed} onClick={save}><Save size={16}/>Save view</button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="column-settings"><DialogHeader><DialogTitle>Sales workspace columns</DialogTitle><DialogDescription>Choose the columns you want to see. Changes preview immediately. Save view remembers your layout in this browser.</DialogDescription></DialogHeader><div className="column-options">{staffColumns.filter(c=>c.id!=='gp'||allowGp).map(c=><label key={c.id}><Checkbox checked={visible(c.id)} disabled={c.id==='product'} onCheckedChange={checked=>setVisible(c.id,checked===true)}/><span>{c.label}{c.id==='product'&&<small>Always visible</small>}</span></label>)}</div><p className="column-settings-tip">Scroll horizontally to see more columns. Drag a heading’s right edge to adjust its width. You can also focus an edge and use the arrow keys.</p><div className="column-settings-actions"><button className="text-button" onClick={()=>setLayout(defaults())}>Restore defaults</button><button className="btn outline" onClick={()=>setOpen(false)}>Close</button><button className="btn primary" onClick={save}><Save size={16}/>Save view</button></div></DialogContent></Dialog></>;
 return {visible,columns,totalWidth:total,width:(id:ColumnId)=>layout.widths[id]/total*100,resizeHandle,controls,changed};
}
