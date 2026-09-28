'use client';
import {useId} from 'react';
import {Forklift} from 'lucide-react';
import {RadioGroup,RadioGroupItem} from '@/components/ui/radio-group';
import {HAND_UNLOAD_FEE} from '@/lib/fulfilment';

export default function CustomerUnloading({handling,disabled,onChange}:{handling:number;disabled:boolean;onChange:(handling:number)=>void}){
 const id=useId(),method=handling===0?'forklift':'hand',filterId='no-forklift-'+id.replace(/[^a-zA-Z0-9_-]/g,'');
 return <RadioGroup className="customer-unloading-options" aria-label="Delivery unloading method" value={method} disabled={disabled} onValueChange={value=>onChange(value==='forklift'?0:HAND_UNLOAD_FEE)}>
  {([{value:'forklift',label:'I have a forklift to unload the delivery'},{value:'hand',label:'I don’t have a forklift for delivery'}] as const).map(option=><label key={option.value} htmlFor={id+option.value} className={'customer-unloading-choice'+(method===option.value?' selected':'')}>
   <RadioGroupItem id={id+option.value} value={option.value} aria-label={option.label}/>
   {option.value==='forklift'?<Forklift size={24} aria-hidden="true"/>:<svg className="no-forklift-icon" viewBox="0 0 333 372" width={32} height={36} aria-hidden="true" focusable="false"><defs><filter id={filterId} colorInterpolationFilters="sRGB"><feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -1.1 0 0 1.1 0" result="iconShape"/><feFlood floodColor="currentColor"/><feComposite in2="iconShape" operator="in"/></filter></defs><image href="/no-forklift.jpg" width={333} height={372} filter={'url(#'+filterId+')'}/></svg>}
   <strong>{option.label}</strong>
  </label>)}
 </RadioGroup>;
}
