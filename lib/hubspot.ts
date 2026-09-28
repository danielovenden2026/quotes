import 'server-only';
import {env} from 'cloudflare:workers';
import {mapHubSpotContact,type HubSpotRecord,type HubSpotCompany} from './hubspot-contact';

const credentialPath='integrations/hubspot/credential-v1';
const properties=['firstname','lastname','email','company','address','city','state','zip','country'];
export class HubSpotError extends Error {constructor(message:string,public status=503){super(message);}}
async function encryptionKey(){
 if(!env.BUCKET)throw new HubSpotError('HubSpot storage is not configured. Add the BUCKET R2 binding in Cloudflare.');
 if(!env.HUBSPOT_CREDENTIAL_KEY)throw new HubSpotError('HubSpot secure storage needs the HUBSPOT_CREDENTIAL_KEY runtime secret in Cloudflare. Add the secret, redeploy, then connect again.');
 const raw=Uint8Array.from(atob(env.HUBSPOT_CREDENTIAL_KEY),c=>c.charCodeAt(0));
 return crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt','decrypt']);
}
export async function hubspotConfigured(){return !!env.HUBSPOT_ACCESS_TOKEN||!!(env.BUCKET&&await env.BUCKET.head(credentialPath));}
export async function testHubSpotConnection(){
 await hubspotRequest('/crm/v3/objects/contacts?limit=1&properties=email');
 await hubspotRequest('/crm/v3/objects/companies?limit=1&properties=name');
}
export async function saveHubSpotToken(token:string){
 if(env.HUBSPOT_ACCESS_TOKEN)throw new HubSpotError('This connection is managed in hosting settings. Update its token there.',409);
 const key=await encryptionKey();
 // Verify both read scopes before replacing an existing working connection.
 await hubspotRequest('/crm/v3/objects/contacts?limit=1&properties=email',undefined,token);
 await hubspotRequest('/crm/v3/objects/companies?limit=1&properties=name',undefined,token);
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(credentialPath)},key,new TextEncoder().encode(token));
 await env.BUCKET!.put(credentialPath,JSON.stringify({version:1,iv:Array.from(iv),data:Array.from(new Uint8Array(encrypted))}),{httpMetadata:{contentType:'application/json'}});
}
export async function disconnectHubSpot(){
 if(env.HUBSPOT_ACCESS_TOKEN)throw new HubSpotError('This connection is managed in hosting settings. Remove its token there.',409);
 await env.BUCKET?.delete(credentialPath);
}
async function accessToken(){
 if(env.HUBSPOT_ACCESS_TOKEN)return env.HUBSPOT_ACCESS_TOKEN;
 const stored=await env.BUCKET?.get(credentialPath);
 if(!stored)throw new HubSpotError('Connect HubSpot before searching contacts.',409);
 try{
  const key=await encryptionKey();
  const value=await stored.json<{version:number;iv:number[];data:number[]}>();
  if(value.version!==1)throw Error();
  return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(value.iv),additionalData:new TextEncoder().encode(credentialPath)},key,new Uint8Array(value.data)));
 }catch{throw new HubSpotError('The HubSpot connection could not be unlocked. Reconnect HubSpot.');}
}
export async function hubspotRequest(path:string,body?:unknown,token?:string):Promise<any>{
 const secret=token||await accessToken();
 let response:Response;
 try{response=await fetch('https://api.hubapi.com'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+secret,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),redirect:'manual',signal:AbortSignal.timeout(12000)});}
 catch{throw new HubSpotError('HubSpot could not be reached. Please try again.');}
 // Workers reject redirect:'error' before making a request. Manual mode keeps
 // the token on the fixed HubSpot host; reject redirects without following them.
 if(response.status>=300&&response.status<400)throw new HubSpotError('HubSpot returned an unexpected redirect. The connection was not saved.');
 if(!response.ok){
  if(response.status===401)throw new HubSpotError('HubSpot rejected the token. Reconnect with a valid private-app token.',409);
  if(response.status===403)throw new HubSpotError(path.startsWith('/crm/v3/properties/companies')?'HubSpot could not read company properties. Enable company property/schema read access for the private app.':'The HubSpot app needs Contacts read and Companies read permissions.',409);
  if(response.status===404)throw new HubSpotError('This HubSpot contact or company no longer exists.',404);
  if(response.status===429)throw new HubSpotError('HubSpot is busy. Wait a few seconds and try again.',429);
  throw new HubSpotError('HubSpot could not complete this request. Please try again.');
 }
 // Never echo upstream errors, credentials, or unselected CRM properties to clients.
 try{return await response.json();}catch{throw new HubSpotError('HubSpot returned an unreadable response. Please try again.');}
}
// Load associations in batches, following each contact's pagination independently.
async function companyAssociations(contactIds:string[]){
 const idsByContact=new Map(contactIds.map(id=>[id,new Set<string>()]));
 const unavailable=new Set<string>(),retry=new Map<string,string|undefined>();
 let pending:{id:string;after?:string}[]=contactIds.map(id=>({id}));
 const seen=new Set<string>();
 const add=(id:string,items:{toObjectId:unknown}[])=>{for(const item of items){const companyId=String(item.toObjectId);if(/^\d+$/.test(companyId))idsByContact.get(id)?.add(companyId);}};
 while(pending.length){
  let data:any;
  try{data=await hubspotRequest('/crm/v4/associations/contacts/companies/batch/read',{inputs:pending});}
  catch{pending.forEach(input=>unavailable.add(input.id));break;}
  // A multi-status batch can contain useful results AND errors for other IDs.
  // Retry only missing/incomplete rows; do not discard successful contacts.
  const rows=new Map<string,any>((data.results||[]).map((row:any)=>[String(row.from?.id),row]));
  const next:{id:string;after:string}[]=[];
  for(const input of pending){
   const row=rows.get(input.id);
   if(data.status&&data.status!=='COMPLETE'||!Array.isArray(row?.to)){retry.set(input.id,input.after);continue;}
   add(input.id,row.to);
   if(row.paging?.next?.after!==undefined){
    const after=String(row.paging.next.after),key=input.id+':'+after;
    if(seen.has(key)){retry.set(input.id,undefined);continue;}
    seen.add(key);next.push({id:input.id,after});
   }
  }
  pending=next;
 }
 const recover=async([id,initialAfter]:[string,string|undefined])=>{
  let after=initialAfter;const cursors=new Set<string>();
  try{do{
   const data=await hubspotRequest('/crm/v4/objects/contacts/'+id+'/associations/companies?limit=500'+(after===undefined?'':'&after='+encodeURIComponent(after)));
   if(!Array.isArray(data.results))throw Error();
   add(id,data.results);
   if(data.paging?.next?.after===undefined)break;
   after=String(data.paging.next.after);if(cursors.has(after))throw Error();cursors.add(after);
  }while(true);}catch{unavailable.add(id);}
 };
 // Keep retries bounded in parallel so partial batches don't flood HubSpot.
 const retries=[...retry];
 for(let i=0;i<retries.length;i+=3)await Promise.all(retries.slice(i,i+3).map(recover));
 return {idsByContact,unavailable};
}
async function readHubSpotCompanies(ids:string[],warnings:string[]):Promise<HubSpotCompany[]>{
 if(!ids.length)return [];
  // Resolve the account's real internal name from its label; never guess it.
  let vendorProperty:string|undefined;
  try{
   const schema=await hubspotRequest('/crm/v3/properties/companies');
   const matches=(schema.results||[]).filter((p:{label?:string;name?:string;archived?:boolean})=>!p.archived&&typeof p.name==='string'&&p.name&&p.label?.toLowerCase().replace(/[^a-z0-9]/g,'')==='verdexvendorno');
   if(matches.length===1)vendorProperty=matches[0].name;
   else warnings.push(matches.length?'More than one company field is labelled Verdex Vendor No. Enter Vendor Number manually until the duplicate labels are resolved.':'The company field Verdex Vendor No was not found. Enter Vendor Number manually if required.');
  }catch(error){warnings.push((error instanceof HubSpotError?error.message:'Company properties could not be loaded.')+' Vendor Number could not be imported; check it before saving.');}
  const results:HubSpotRecord[]=[];
  for(let offset=0;offset<ids.length;offset+=100){
   try{
    const records=await hubspotRequest('/crm/v3/objects/companies/batch/read',{properties:['name',...(vendorProperty?[vendorProperty]:[])],inputs:ids.slice(offset,offset+100).map(id=>({id}))});
    if(records.errors?.length)warnings.push('Some company details could not be loaded. Select the contact to try again.');
    results.push(...(records.results||[]));
   }catch{warnings.push('Some company details could not be loaded. Select the contact to try again.');}
  }
  return results.map((r:HubSpotRecord)=>{
   const name=(r.properties.name||'Unnamed company').trim().slice(0,200);
   const vendorNumber=vendorProperty?String(r.properties[vendorProperty]??'').trim():undefined;
   if(vendorNumber&&vendorNumber.length>100)warnings.push('Verdex Vendor No for '+name+' exceeds 100 characters. Enter a valid Vendor Number manually.');
   return {id:String(r.id),name,...(vendorNumber!==undefined&&vendorNumber.length<=100?{vendorNumber}:{})};
  });
}
export async function searchHubSpotContacts(query:string,after?:string){
 const data=await hubspotRequest('/crm/v3/objects/contacts/search',{query,properties,limit:20,...(after?{after}: {})});
 const records:HubSpotRecord[]=data.results||[];
 const {idsByContact:associations,unavailable}=await companyAssociations(records.map(record=>String(record.id)));
 const warnings:string[]=[];
 if(unavailable.size)warnings.push('Some linked companies could not be loaded. Contact details are still available; select a contact to retry its companies.');
 const ids=[...new Set([...associations.values()].flatMap(ids=>[...ids]))];
 const companies=await readHubSpotCompanies(ids,warnings);
 const byId=new Map(companies.map(company=>[company.id,company]));
 if(ids.some(id=>!byId.has(id)))warnings.push('Some linked companies are unavailable in HubSpot.');
 return {contacts:records.map(record=>{const c=mapHubSpotContact(record);return {id:c.id,contact:c.contact,email:c.email,company:c.company,address:c.address,suburb:c.suburb,state:c.state,postcode:c.postcode,companiesIncomplete:unavailable.has(c.id),companies:[...(associations.get(c.id)||[])].map(id=>byId.get(id)||{id,name:'Company details unavailable'})};}),warnings:[...new Set(warnings)],after:data.paging?.next?.after?String(data.paging.next.after):null};
}
export async function getHubSpotContact(id:string){
 const data:HubSpotRecord=await hubspotRequest('/crm/v3/objects/contacts/'+id+'?properties='+properties.join(','));
 const contact=mapHubSpotContact(data);
 const {idsByContact:associations,unavailable}=await companyAssociations([id]);
 if(unavailable.has(id))contact.warnings.push('Linked companies could not be fully loaded. Check the company and Vendor Number manually, or select this contact again to retry.');
 const ids=[...(associations.get(id)||[])];
 const companies=await readHubSpotCompanies(ids,contact.warnings);
 if(companies.length<ids.length)contact.warnings.push('Some linked companies are unavailable in HubSpot. Check the company before saving.');
 return {contact,companies};
}
