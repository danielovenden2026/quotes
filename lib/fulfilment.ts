export type FulfilmentMethod = 'delivery' | 'pickup' | 'own-freight';
export const HAND_UNLOAD_FEE = 2500; // AUD cents, excluding GST.
export const PICKUP_FEE = 3500; // AUD cents, excluding GST.
// Keep the quoted delivery rates intact when pickup is selected.
export function fulfilmentCharges(q:{fulfilmentMethod?:FulfilmentMethod;freight:number;handling:number}){
 const ownFreight=q.fulfilmentMethod==='own-freight';
 const pickup=q.fulfilmentMethod==='pickup';
 return {pickup,ownFreight,method:ownFreight?'Own Freight':pickup?'Pickup':'Delivery',total:ownFreight?0:pickup?PICKUP_FEE:q.freight+q.handling};
}
