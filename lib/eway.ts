import 'server-only';
import {env} from 'cloudflare:workers';
import {z} from 'zod';
const storagePath='integrations/eway/credential-v1';
const encoded=new TextEncoder();
const credentialsSchema=z.object({mode:z.enum(['sandbox','live']),apiKey:z.string().trim().min(10).max(500).regex(/^[\x21-\x7e]+$/).refine(v=>!v.includes(':')),apiPassword:z.string().min(1).max(500).regex(/^[\x20-\x7e]+$/)});
type Credentials=z.infer<typeof credentialsSchema>;
type Saved=Credentials&{verifiedAt:string};
export class EwayError extends Error{constructor(message:string,public status=400){super(message);}}
export function parseEwayCredentials(value:unknown):Credentials{
 const result=credentialsSchema.safeParse(value);if(!result.success)throw new EwayError('Select Test or Live and enter your eWAY API Key and API Password.');return result.data;
}
async function encryptionKey(){
 // Domain-separated derivation from the existing server encryption secret.
 // An optional dedicated EWAY_CREDENTIAL_KEY can be configured before first use.
 const secret=env.EWAY_CREDENTIAL_KEY||env.HUBSPOT_CREDENTIAL_KEY;
 if(!secret||!env.BUCKET)throw new EwayError('Secure connection storage is not configured.',503);
 const source=Uint8Array.from(atob(secret),c=>c.charCodeAt(0));if(source.length!==32)throw new EwayError('Secure connection storage is not configured.',503);
 const key=await crypto.subtle.importKey('raw',source,'HKDF',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt:encoded.encode('verdex-integrations-v1'),info:encoded.encode(storagePath)},key,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export async function getEwayCredentials():Promise<Saved|null>{
 const object=await env.BUCKET?.get(storagePath);if(!object)return null;
 try{const value=await object.json<{version:number;iv:number[];data:number[]}>();if(value.version!==1)throw Error();const raw=await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(value.iv),additionalData:encoded.encode(storagePath)},await encryptionKey(),new Uint8Array(value.data));const data=JSON.parse(new TextDecoder().decode(raw));return {...parseEwayCredentials(data),verifiedAt:z.string().datetime().parse(data.verifiedAt)};}catch{throw new EwayError('The saved eWAY connection could not be unlocked. Enter both credentials again to replace it.',503);}
}
export async function ewayStatus(){const saved=await getEwayCredentials();return {configured:!!saved,mode:saved?.mode||'sandbox',verifiedAt:saved?.verifiedAt||null,paymentsEnabled:false,testPaymentsEnabled:saved?.mode==='sandbox',secureStorageReady:!!(env.BUCKET&&(env.EWAY_CREDENTIAL_KEY||env.HUBSPOT_CREDENTIAL_KEY))};}
export async function testEwayConnection(credentials:Credentials){
 // A read-only lookup of a fresh, nonexistent invoice tests authentication.
 // It never creates an access code, charges a card, or returns transaction data.
 const host=credentials.mode==='live'?'https://api.ewaypayments.com':'https://api.sandbox.ewaypayments.com';
 let response:Response;
 try{response=await fetch(host+'/Transaction/InvoiceNumber/'+crypto.randomUUID().replaceAll('-',''),{method:'GET',headers:{Authorization:'Basic '+btoa(credentials.apiKey+':'+credentials.apiPassword),Accept:'application/json','X-EWAY-APIVERSION':'47'},redirect:'manual',signal:AbortSignal.timeout(12000)});}catch{throw new EwayError('eWAY could not be reached. Please try again.',503);}
 if(response.status===401||response.status===403)throw new EwayError('eWAY rejected these credentials. Check the API Key, API Password and Test / Live mode. Use the Rapid API credentials, not your login password or public key.');
 if(response.status>=300&&response.status<400)throw new EwayError('eWAY returned an unexpected redirect. The connection was not saved.',503);
 if(response.status===429)throw new EwayError('eWAY is busy. Wait a moment and try again.',429);
 if(!response.ok&&response.status!==400)throw new EwayError('eWAY could not verify the connection. Please try again.',503);
 let data:any;try{data=await response.json();}catch{throw new EwayError('eWAY returned an unexpected response. The connection was not saved.',503);}
 const errors=typeof data?.Errors==='string'?data.Errors.split(',').map((v:string)=>v.trim()).filter(Boolean):[];
 const notFound=errors.length===1&&errors[0]==='V6171';
 const validResult=response.ok&&Array.isArray(data?.Transactions)&&!data.Errors;
 if(!notFound&&!validResult)throw new EwayError('eWAY could not verify API access. Check your account’s Rapid API access and selected mode.');
 return new Date().toISOString();
}
export async function saveEwayConnection(value:unknown){
 const credentials=parseEwayCredentials(value),key=await encryptionKey(),verifiedAt=await testEwayConnection(credentials);
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoded.encode(storagePath)},key,encoded.encode(JSON.stringify({...credentials,verifiedAt})));
 await env.BUCKET!.put(storagePath,JSON.stringify({version:1,iv:Array.from(iv),data:Array.from(new Uint8Array(encrypted))}),{httpMetadata:{contentType:'application/json'}});
 return {configured:true,mode:credentials.mode,verifiedAt,paymentsEnabled:false,testPaymentsEnabled:credentials.mode==='sandbox',secureStorageReady:true};
}
export async function disconnectEway(){await env.BUCKET?.delete(storagePath);}
