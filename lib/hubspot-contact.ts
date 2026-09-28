import {australianStates,stateNames} from './delivery-address';
import type {Quote} from './quote';

export type HubSpotRecord={id:string;properties:Record<string,string|null>;associations?:{companies?:{results:{id:string;type?:string}[];paging?:unknown}}};
export type HubSpotContact={id:string;contact:string;email:string;company:string;address:string;suburb:string;state:string;postcode:string;warnings:string[]};
export type HubSpotCompany={id:string;name:string;vendorNumber?:string};
export function hubSpotQuotePatch(contact:HubSpotContact,company:HubSpotCompany|undefined,quote:Quote):Partial<Quote>{
 const changed=quote.hubspotContactId!==contact.id||(quote.hubspotCompanyId||'')!==(company?.id||'');
 return {contact:contact.contact,email:contact.email,company:company?.name||contact.company,address:contact.address,suburb:contact.suburb,state:contact.state,postcode:contact.postcode,hubspotContactId:contact.id,hubspotCompanyId:company?.id||'',vendorNumber:company?.vendorNumber??(changed?'':quote.vendorNumber||''),...(changed?{customerTerms:'',reference:''}:{})};
}
// HubSpot state fields sometimes contain the city as well as the state.
// Match complete words, tolerate spacing/punctuation, and leave conflicts blank.
export function matchHubSpotState(value:string){
 const normalized=' '+value.toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim()+' ';
 const matches=australianStates.filter(state=>normalized.includes(' '+state+' ')||normalized.includes(' '+stateNames[state].toUpperCase()+' '));
 return matches.length===1?matches[0]:'';
}
export function mapHubSpotContact(record:HubSpotRecord):HubSpotContact {
 const p=record.properties;
 const value=(key:string,max=200)=>(p[key]||'').trim().slice(0,max);
 const rawState=value('state'),rawPostcode=value('zip'),country=value('country');
 const state=matchHubSpotState(rawState);
 const postcode=/^\d{4}$/.test(rawPostcode)?rawPostcode:'';
 const warnings:string[]=[];
 const contact=[value('firstname'),value('lastname')].filter(Boolean).join(' ').slice(0,200);
 if(!contact)warnings.push('This contact has no name. Enter a contact name on the quote.');
 if(!value('email'))warnings.push('This contact has no email address. Enter an email address on the quote.');
 if(!value('address',500)||!value('city',100)||!state||!postcode)warnings.push('The contact address is incomplete. Check the street, suburb, state and postcode before saving.');
 if(rawState&&!state)warnings.push('State could not be matched: '+rawState);
 if(rawPostcode&&!postcode)warnings.push('Postcode could not be matched: '+rawPostcode);
 if(country&&!/^(australia|au|aus)$/i.test(country))warnings.push('Contact country is '+country+'. This quote uses an Australian address format.');
 return {id:String(record.id),contact,email:value('email',254),company:value('company'),address:value('address',500),suburb:value('city',100),state,postcode,warnings};
}
