// Quoted price is retained before discount. Amount discounts are cents per unit;
// percentage discounts use up to two decimal places. Round the net unit once.
export type LineDiscount={type:'amount'|'percent';value:number};
export type PricedLine={price:number;discount?:LineDiscount};
export function validDiscount(line:PricedLine):boolean{
 const d=line.discount;if(d===undefined)return true;
 if(!d||!Number.isFinite(d.value)||d.value<0)return false;
 return d.type==='amount'?Number.isSafeInteger(d.value)&&d.value<=line.price:d.type==='percent'&&d.value<=100&&Math.abs(d.value*100-Math.round(d.value*100))<1e-7;
}
export function netUnitPrice(line:PricedLine):number{
 const d=line.discount;if(!d||!d.value)return line.price;
 return Math.max(0,d.type==='percent'?Math.round(line.price*(10000-Math.round(d.value*100))/10000):line.price-d.value);
}
export const lineSubtotal=(line:PricedLine&{qty:number})=>netUnitPrice(line)*line.qty;
export const hasDiscount=(line:PricedLine)=>!!line.discount&&line.discount.value>0;
export function discountLabel(line:PricedLine):string{
 if(!hasDiscount(line))return '';
 return line.discount!.type==='percent'?line.discount!.value+'% off':new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(line.discount!.value/100)+' off / unit';
}
