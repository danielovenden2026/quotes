import {z} from 'zod';
import {australianStates} from './delivery-address';
import {freightFingerprint} from './freight';
import type {Quote} from './quote';
const required=(label:string,max=200)=>z.string().trim().min(1,label+' is required.').max(max);
export const checkoutAddressSchema=z.object({
 addressType:z.enum(['business','home']),firstName:required('First name'),lastName:required('Last name'),company:z.string().trim().max(200),country:z.literal('AU'),street1:required('Street address',400),street2:z.string().trim().max(100),state:z.enum(australianStates),city:required('City / suburb',100),postcode:z.string().trim().regex(/^\d{4}$/,'Enter a four-digit postcode.'),phone:required('Phone number',40).refine(v=>v.replace(/\D/g,'').length>=7,'Enter a valid phone number.')
});
export const checkoutSchema=z.object({email:z.string().trim().email('Enter a valid email address.'),billing:checkoutAddressSchema,sameAddress:z.boolean(),shipping:z.unknown().optional(),fulfilmentMethod:z.enum(['delivery','pickup','own-freight']),hasForklift:z.boolean(),paymentMethod:z.enum(['invoice','eft','paypal','account','card']),orderComment:z.string().trim().max(2000),purchaseOrder:z.string().trim().max(200)}).transform((v,ctx)=>{
 const shipping=checkoutAddressSchema.safeParse(v.sameAddress||v.fulfilmentMethod==='pickup'?v.billing:v.shipping);
 if(!shipping.success){shipping.error.issues.forEach(i=>ctx.addIssue({...i,path:['shipping',...i.path]}));return z.NEVER;}
 return {...v,shipping:shipping.data};
});
export type CheckoutAddress=z.infer<typeof checkoutAddressSchema>;
export type CheckoutDetails=z.infer<typeof checkoutSchema>;
export function initialCheckout(q:Quote):CheckoutDetails {
 if(q.checkout)return structuredClone(q.checkout);
 const names=q.contact.trim().split(/\s+/);const billing:CheckoutAddress={addressType:q.company?'business':'home',firstName:names.shift()||'',lastName:names.join(' '),company:q.company,country:'AU',street1:q.address,street2:'',city:q.suburb||'',state:(australianStates.includes(q.state as any)?q.state:'') as CheckoutAddress['state'],postcode:q.postcode||'',phone:''};
 return {email:q.email,billing,sameAddress:true,shipping:{...billing},fulfilmentMethod:q.fulfilmentMethod||'delivery',hasForklift:q.handling===0,paymentMethod:'card',orderComment:q.instructions||q.deliveryNotes||'',purchaseOrder:q.po||''};
}
export function checkoutShipment(q:Quote,d:CheckoutDetails):Quote {
 const address=d.sameAddress?d.billing:d.shipping;
 const next={...q,fulfilmentMethod:d.fulfilmentMethod,handling:d.hasForklift?0:2500};
 if(d.fulfilmentMethod!=='pickup')Object.assign(next,{address:[address.street1.trim(),address.street2.trim()].filter(Boolean).join(', '),suburb:address.city.trim(),state:address.state,postcode:address.postcode.trim()});
 // A manually quoted rate is also invalidated if checkout changes its destination.
 if(freightFingerprint(next)!==freightFingerprint(q)&&!next.freightEstimate)next.freightEstimate={fingerprint:freightFingerprint(q),amount:q.freight,carrierCode:'',methodCode:'',label:'Quoted delivery',calculatedAt:new Date().toISOString()};
 return next;
}
