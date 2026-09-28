import {lineKey,type Item,type Quote} from './quote';
// Store formatting as data, never executable HTML or arbitrary attributes.
export type NoteNode={type:'text'|'p'|'br'|'strong'|'em'|'u'|'ul'|'ol'|'li'|'h3';text?:string;children?:NoteNode[]};
// beforeSku also accepts the unique line ID, preserving anchors in legacy quotes.
export type QuoteBlock={id:string;kind:'divider'|'note';beforeSku:string|null;content:NoteNode[]};
export type QuoteRow={id:string;kind:'product';item:Item}|{id:string;kind:'block';block:QuoteBlock};
export function quoteRows(q:Pick<Quote,'items'|'blocks'>):QuoteRow[]{
 const rows:QuoteRow[]=[],blocks=q.blocks||[],skus=new Set(q.items.map(i=>lineKey(i)));
 for(const item of q.items){for(const block of blocks.filter(b=>b.beforeSku===lineKey(item)))rows.push({id:'block:'+block.id,kind:'block',block});rows.push({id:lineKey(item),kind:'product',item});}
 for(const block of blocks.filter(b=>!b.beforeSku||!skus.has(b.beforeSku)))rows.push({id:'block:'+block.id,kind:'block',block});
 return rows;
}
// Automatic suggestions stay in the quote data for the customer, totals and freight.
export function staffQuoteRows(q:Pick<Quote,'items'|'blocks'>):QuoteRow[]{
 const items=q.items.filter(i=>!i.autoOptionFor||!i.optional);
 return quoteRows({items,blocks:reanchorBlocks(q,items)});
}
// Keep unsaved zero quantities editable; hide saved removals from customers.
export function customerQuoteRows(q:Pick<Quote,'items'|'blocks'>,beforeSave?:Pick<Quote,'items'>,includeOptional=false):QuoteRow[]{
 const items=q.items.filter(i=>i.optional?includeOptional:(i.qty>0||!!beforeSave?.items.some(old=>lineKey(old)===lineKey(i)&&old.qty>0)));
 return quoteRows({items,blocks:reanchorBlocks(q,items)});
}
// Group only adjacent optional lines; products, dividers and notes retain workspace order.
export type CustomerQuoteSection=QuoteRow|{id:string;kind:'options';items:Item[]};
export function customerQuoteSections(q:Pick<Quote,'items'|'blocks'>,beforeSave?:Pick<Quote,'items'>):CustomerQuoteSection[]{
 const sections:CustomerQuoteSection[]=[];
 for(const row of customerQuoteRows(q,beforeSave,true)){
  if(row.kind==='product'&&row.item.optional){
   const previous=sections.at(-1);
   if(previous?.kind==='options')previous.items.push(row.item);
   else sections.push({id:'options:'+row.id,kind:'options',items:[row.item]});
  }else sections.push(row);
 }
 return sections;
}
export function moveQuoteRow(q:Quote,id:string,target:string,position:'before'|'after'){
 const rows=quoteRows(q),moving=rows.find(r=>r.id===id);if(!moving||id===target||!rows.some(r=>r.id===target))return {items:q.items,blocks:q.blocks||[]};
 const next=rows.filter(r=>r.id!==id);next.splice(next.findIndex(r=>r.id===target)+(position==='after'?1:0),0,moving);
 return {items:next.flatMap(r=>r.kind==='product'?[r.item]:[]),blocks:next.flatMap((r,index)=>r.kind==='block'?[{...r.block,beforeSku:next.slice(index+1).find(r=>r.kind==='product')?.id||null}]:[])};
}
const tags=new Set(['p','br','strong','em','u','ul','ol','li','h3']);
export function cleanNote(nodes:unknown,depth=0):NoteNode[]{
 if(!Array.isArray(nodes)||depth>12)return [];
 return nodes.slice(0,500).flatMap((node):NoteNode[]=>{
  if(!node||typeof node!=='object')return [];
  if(node.type==='text')return typeof node.text==='string'?[{type:'text',text:node.text.slice(0,10000)}]:[];
  if(!tags.has(node.type))return [];
  return [{type:node.type,children:cleanNote(node.children,depth+1)}];
 });
}
const escape=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export function noteHtml(nodes:NoteNode[]):string{return cleanNote(nodes).map(n=>n.type==='text'?escape(n.text||''):n.type==='br'?'<br>':`<${n.type}>${noteHtml(n.children||[])}</${n.type}>`).join('');}
export function noteText(nodes:NoteNode[]):string{
 return cleanNote(nodes).map(n=>{
  if(n.type==='text')return n.text||'';
  if(n.type==='br')return '\n';
  if(n.type==='ul'||n.type==='ol')return (n.children||[]).map((c,i)=>(n.type==='ol'?(i+1)+'. ':'- ')+noteText(c.children||[])+'\n').join('');
  return noteText(n.children||[])+(['p','li','h3'].includes(n.type)?'\n':'');
 }).join('');
}
export function reanchorBlocks(q:Pick<Quote,'items'|'blocks'>,items:Item[]):QuoteBlock[]{
 const remaining=new Set(items.map(lineKey));
 return (q.blocks||[]).map(b=>{
  if(!b.beforeSku||remaining.has(b.beforeSku))return b;
  const next=q.items.slice(q.items.findIndex(i=>lineKey(i)===b.beforeSku)+1).find(i=>remaining.has(lineKey(i)));
  return {...b,beforeSku:next?lineKey(next):null};
 });
}

export function newBlockId():string{const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');}
