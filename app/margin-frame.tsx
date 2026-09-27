'use client';
import {useEffect,useId,useRef} from 'react';

// The payload contains only SKU, quoted price and selection/quantity inputs.
// The browser submits a normal form; numeric margins never enter React state.
export default function MarginFrame({payload,summary=false,title}:{payload:string;summary?:boolean;title:string}){
  const name='gp-'+useId().replace(/[^a-zA-Z0-9]/g,'');
  const form=useRef<HTMLFormElement>(null);
  useEffect(()=>{form.current?.submit();},[payload,summary]);
  return <><form ref={form} action="/admin/gp" method="post" target={name} hidden><input name="items" type="hidden" value={payload}/><input name="kind" type="hidden" value={summary?'summary':'line'}/></form><iframe name={name} title={title} sandbox="" referrerPolicy="no-referrer" className={summary?'overall-gp-frame':'line-gp-frame'}/></>;
}
