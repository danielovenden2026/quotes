'use client';
import {useEffect,useRef,useState} from 'react';
import {Bold,Italic,Underline,List,ListOrdered,Heading,RemoveFormatting} from 'lucide-react';
import {Toggle} from '@/components/ui/toggle';
import {noteHtml,type NoteNode,type QuoteBlock} from '@/lib/quote-layout';
export function QuoteBlockView({block}:{block:QuoteBlock}){return block.kind==='divider'?<hr className="quote-divider"/>:<div className="quote-rich-text customer-quote-note" dangerouslySetInnerHTML={{__html:noteHtml(block.content)}}/>;}
function readNodes(parent:Node):NoteNode[]{
 return Array.from(parent.childNodes).flatMap((node):NoteNode[]=>{
  if(node.nodeType===3)return [{type:'text',text:node.textContent||''}];
  if(!(node instanceof HTMLElement))return [];
  const tag=node.tagName.toLowerCase();if(['script','style','iframe','object','svg','math','template'].includes(tag))return [];
  const children=readNodes(node),type=({b:'strong',i:'em',div:'p',h1:'h3',h2:'h3'} as Record<string,string>)[tag]||tag;
  return ['p','br','strong','em','u','ul','ol','li','h3'].includes(type)?[{type:type as NoteNode['type'],children}]:children;
 });
}
export function QuoteNoteEditor({value,onChange,disabled,label}:{value:NoteNode[];onChange:(value:NoteNode[])=>void;disabled:boolean;label:string}){
 const ref=useRef<HTMLDivElement>(null),selection=useRef<Range|null>(null),[active,setActive]=useState<Record<string,boolean>>({});
 useEffect(()=>{const editor=ref.current;if(editor&&document.activeElement!==editor)editor.innerHTML=noteHtml(value);},[value]);
 function remember(){const s=window.getSelection();if(s?.rangeCount&&ref.current?.contains(s.anchorNode)){selection.current=s.getRangeAt(0).cloneRange();setActive(Object.fromEntries(['bold','italic','underline','insertUnorderedList','insertOrderedList'].map(c=>[c,document.queryCommandState(c)])));}}
 function emit(){if(ref.current)onChange(readNodes(ref.current));remember();}
 function command(name:string,arg?:string){const editor=ref.current;if(!editor||disabled)return;editor.focus();const s=window.getSelection();if(s){const range=selection.current&&editor.contains(selection.current.commonAncestorContainer)?selection.current:document.createRange();if(range!==selection.current){range.selectNodeContents(editor);range.collapse(false);}s.removeAllRanges();s.addRange(range);}document.execCommand(name,false,arg);emit();}
 return <div className={'quote-note-editor '+(disabled?'read-only':'')}><div className="quote-note-toolbar" role="toolbar" aria-label="Note formatting">{([{cmd:'bold',label:'Bold',Icon:Bold},{cmd:'italic',label:'Italic',Icon:Italic},{cmd:'underline',label:'Underline',Icon:Underline},{cmd:'insertUnorderedList',label:'Bullet list',Icon:List},{cmd:'insertOrderedList',label:'Numbered list',Icon:ListOrdered}] as const).map(({cmd,label,Icon})=><Toggle type="button" size="sm" key={cmd} aria-label={label} title={label} disabled={disabled} pressed={!!active[cmd]} onMouseDown={e=>e.preventDefault()} onPressedChange={()=>command(cmd)}><Icon size={16}/></Toggle>)}<button type="button" title="Heading" aria-label="Heading" disabled={disabled} onMouseDown={e=>e.preventDefault()} onClick={()=>command('formatBlock','h3')}><Heading size={16}/></button><button type="button" disabled={disabled} onMouseDown={e=>e.preventDefault()} onClick={()=>command('formatBlock','p')}>Normal text</button><button type="button" title="Clear formatting" aria-label="Clear formatting" disabled={disabled} onMouseDown={e=>e.preventDefault()} onClick={()=>{command('removeFormat');command('formatBlock','p');}}><RemoveFormatting size={16}/></button></div><div ref={ref} className="quote-rich-text quote-note-input" contentEditable={!disabled} suppressContentEditableWarning role="textbox" aria-label={label} aria-multiline="true" aria-readonly={disabled} data-placeholder="Enter details for the customer…" onInput={emit} onKeyUp={remember} onMouseUp={remember} onBlur={remember} onPaste={e=>{e.preventDefault();document.execCommand('insertText',false,e.clipboardData.getData('text/plain'));emit();}} onDrop={e=>e.preventDefault()}/></div>;
}
