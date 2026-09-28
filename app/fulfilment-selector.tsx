 'use client';
import {useId} from 'react';
import {Truck,Package} from 'lucide-react';
import {Checkbox} from '@/components/ui/checkbox';
import {RadioGroup,RadioGroupItem} from '@/components/ui/radio-group';
import {money,type Quote} from '@/lib/quote';
import {PICKUP_FEE,type FulfilmentMethod} from '@/lib/fulfilment';
export default function FulfilmentSelector({quote,disabled,onChange,onHidePickupChange,onHideOwnFreightChange,customerView=false}:{customerView?:boolean;quote:Quote;disabled:boolean;onHidePickupChange?:(hidden:boolean)=>void;onHideOwnFreightChange?:(hidden:boolean)=>void;onChange:(method:FulfilmentMethod)=>void}){
 const id=useId(),method=quote.fulfilmentMethod||'delivery';
 return <><RadioGroup className="fulfilment-options" aria-label="Shipping options" value={method} disabled={disabled} onValueChange={value=>onChange(value as FulfilmentMethod)}>
 {([{value:'delivery',label:'Delivery',price:quote.freight+quote.handling,detail:'Includes freight and site handling',Icon:Truck},{value:'pickup',label:'Pickup',price:PICKUP_FEE,detail:'Collect from Verdex',Icon:Package},{value:'own-freight',label:'Own Freight',price:0,detail:'Arrange your own carrier',Icon:Truck}] as const).filter(option=>!!onHidePickupChange||(option.value!=='pickup'||!quote.hidePickup)&&(option.value!=='own-freight'||!quote.hideOwnFreight)).map(option=><label data-fulfilment={option.value} className={'fulfilment-option '+(method===option.value?'selected':'')} key={option.value} htmlFor={id+option.value}><RadioGroupItem id={id+option.value} value={option.value} disabled={option.value==='pickup'&&quote.hidePickup||option.value==='own-freight'&&quote.hideOwnFreight} aria-label={option.label}/><option.Icon size={21} aria-hidden="true"/><span><strong>{option.label}</strong>{!(customerView&&option.value==='delivery')&&<small>{option.detail}</small>}</span>{!(customerView&&option.value==='delivery')&&<b>{money(option.price)}<small>ex GST</small></b>}</label>)}
 </RadioGroup>{onHidePickupChange&&<div className="pickup-visibility"><label className="hide-pickup"><Checkbox checked={quote.hidePickup===true} disabled={disabled} onCheckedChange={value=>onHidePickupChange(value===true)} aria-label="Hide pickup from customer"/><span>Hide pickup from customer</span></label>{onHideOwnFreightChange&&<label className="hide-own-freight"><Checkbox checked={quote.hideOwnFreight===true} disabled={disabled} onCheckedChange={value=>onHideOwnFreightChange(value===true)} aria-label="Hide Own Freight from customer"/><span>Hide Own Freight from customer</span></label>}</div>}</>;
}
