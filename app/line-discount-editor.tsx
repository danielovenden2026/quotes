'use client';
import type {Item} from '@/lib/quote';
import {money} from '@/lib/quote';
import {netUnitPrice,validDiscount,type LineDiscount} from '@/lib/line-pricing';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import WorkspaceNumberInput from './workspace-number-input';
export default function LineDiscountEditor({item,disabled,onChange}:{item:Item;disabled:boolean;onChange:(discount:LineDiscount|undefined)=>void}){
 const discount=item.discount,type=discount?.type||'none',invalid=!validDiscount(item);
 return <div className="line-discount-editor"><Select value={type} disabled={disabled} onValueChange={type=>onChange(type==='none'?undefined:{type:type as LineDiscount['type'],value:0})}><SelectTrigger aria-label={'Discount type '+item.sku}><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">No discount</SelectItem><SelectItem value="percent">% discount</SelectItem><SelectItem value="amount">$ per unit</SelectItem></SelectContent></Select>
 {discount&&<WorkspaceNumberInput key={type} aria-label={'Discount '+(type==='percent'?'percent ':'amount per unit ')+item.sku} aria-invalid={invalid} min="0" max={type==='percent'?100:item.price/100} step="0.01" inputMode="decimal" value={type==='amount'?discount.value/100:discount.value} disabled={disabled} onValueChange={value=>onChange({type:discount.type,value:Math.round(value*100)/(type==='amount'?1:100)})}/>}
 {invalid?<small className="discount-error">{type==='amount'?'Enter $0 up to the quoted price.':'Enter 0–100%.'}</small>:discount&&<small className="discount-net">Net {money(netUnitPrice(item))} / unit</small>}
 </div>;
}
