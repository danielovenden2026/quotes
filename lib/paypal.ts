import 'server-only';
import {env} from 'cloudflare:workers';
import {z} from 'zod';
const storagePath='integrations/paypal/credential-v1';
const encoded=new TextEncoder();
const credentialsSchema=z.object({mode:z.enum(['sandbox','live']),clientId:z.string().trim().min(10).max(500).regex(/^[\x21-\x7e]+$/).refine(v=>!v.includes(':')),clientSecret:z.string().trim().min(10).max(500).regex(/^[\x21-\x7e]+$/)});
type Credentials=z.infer<typeof credentialsSchema>;
type Saved=Credentials&{verifiedAt:string};
export class PaypalError extends Error{constructor(message:string,public status=400){super(message);}}
export function parsePaypalCredentials(value:unknown):Credentials{
 const result=credentialsSchema.safeParse(value);if(!result.success)throw new PaypalError('Select Test or Live and enter your PayPal Client ID and Client Secret.');return result.data;
}
async function encryptionKey(){
 // Domain-separated derivation from the existing server encryption secret.
 // An optional dedicated PAYPAL_CREDENTIAL_KEY can be configured before first use.
 const secret=env.PAYPAL_CREDENTIAL_KEY||env.HUBSPOT_CREDENTIAL_KEY;
 if(!secret||!env.BUCKET)throw new PaypalError('Secure connection storage is not configured.',503);
 const source=Uint8Array.from(atob(secret),c=>c.charCodeAt(0));if(source.length!==32)throw new PaypalError('Secure connection storage is not configured.',503);
 const key=await crypto.subtle.importKey('raw',source,'HKDF',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt:encoded.encode('verdex-integrations-v1'),info:encoded.encode(storagePath)},key,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export async function getPaypalCredentials():Promise<Saved|null>{
 const object=await env.BUCKET?.get(storagePath);if(!object)return null;
 try{const value=await object.json<{version:number;iv:number[];data:number[]}>();if(value.version!==1)throw Error();const raw=await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(value.iv),additionalData:encoded.encode(storagePath)},await encryptionKey(),new Uint8Array(value.data));const data=JSON.parse(new TextDecoder().decode(raw));return {...parsePaypalCredentials(data),verifiedAt:z.string().datetime().parse(data.verifiedAt)};}catch{throw new PaypalError('The saved PayPal connection could not be unlocked. Enter both credentials again to replace it.',503);}
}
export async function paypalStatus(){const saved=await getPaypalCredentials();return {configured:!!saved,mode:saved?.mode||'sandbox',verifiedAt:saved?.verifiedAt||null,paymentsEnabled:false,secureStorageReady:!!(env.BUCKET&&(env.PAYPAL_CREDENTIAL_KEY||env.HUBSPOT_CREDENTIAL_KEY))};}
export async function testPaypalConnection(credentials:Credentials){
 // OAuth token exchange validates the app only; it does not create an order or payment.
 const host=credentials.mode==='live'?'https://api-m.paypal.com':'https://api-m.sandbox.paypal.com';
 let response:Response;
 try{response=await fetch(host+'/v1/oauth2/token',{method:'POST',headers:{Authorization:'Basic '+btoa(credentials.clientId+':'+credentials.clientSecret),Accept:'application/json','Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials',redirect:'manual',signal:AbortSignal.timeout(12000)});}catch{throw new PaypalError('PayPal could not be reached. Please try again.',503);}
 if(response.status===400||response.status===401||response.status===403)throw new PaypalError('PayPal rejected these credentials. Use the Client ID and Client Secret from the same REST app and selected Sandbox or Live mode, not your PayPal login password.');
 if(response.status===429)throw new PaypalError('PayPal is busy. Wait a moment and try again.',429);
 if(!response.ok)throw new PaypalError('PayPal could not verify the connection. Please try again.',503);
 let data:any;try{data=await response.json();}catch{throw new PaypalError('PayPal returned an unexpected response. The connection was not saved.',503);}
 if(typeof data?.access_token!=='string'||!data.access_token||(typeof data.token_type!=='string'||data.token_type.toLowerCase()!=='bearer')||typeof data.expires_in!=='number'||data.expires_in<=0)throw new PaypalError('PayPal could not verify API access. Check your app credentials and selected mode.');
 // The temporary token is deliberately not stored, logged or returned to the browser.
 return new Date().toISOString();
}
export async function savePaypalConnection(value:unknown){
 const credentials=parsePaypalCredentials(value),key=await encryptionKey(),verifiedAt=await testPaypalConnection(credentials);
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoded.encode(storagePath)},key,encoded.encode(JSON.stringify({...credentials,verifiedAt})));
 await env.BUCKET!.put(storagePath,JSON.stringify({version:1,iv:Array.from(iv),data:Array.from(new Uint8Array(encrypted))}),{httpMetadata:{contentType:'application/json'}});
 return {configured:true,mode:credentials.mode,verifiedAt,paymentsEnabled:false,secureStorageReady:true};
}
export async function disconnectPaypal(){await env.BUCKET?.delete(storagePath);}
