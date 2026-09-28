'use client';
import {useId} from 'react';
import {HAND_UNLOAD_FEE} from '@/lib/fulfilment';
import {RadioGroup,RadioGroupItem} from '@/components/ui/radio-group';
export default function UnloadingSelector({handling,disabled,onChange}:{handling:number;disabled:boolean;onChange:(handling:number)=>void}){
 const id=useId();
 return <div className="unloading-selector"><span id={id+'label'} className="unloading-label">Unloading method</span><RadioGroup aria-labelledby={id+'label'} className="unloading-options" value={handling===0?'forklift':handling===HAND_UNLOAD_FEE?'hand':''} disabled={disabled} onValueChange={value=>onChange(value==='hand'?HAND_UNLOAD_FEE:0)}>
 <label htmlFor={id+'forklift'}><RadioGroupItem id={id+'forklift'} value="forklift"/><span>Forklift <small>$0.00</small></span></label>
 <label htmlFor={id+'hand'}><RadioGroupItem id={id+'hand'} value="hand"/><span>Hand unload <small>$25.00 ex GST</small></span></label>
 </RadioGroup></div>;
}
