import {accessStatus} from '@/lib/workspace-access';
import {env} from 'cloudflare:workers';
import {adminAccess,privateHeaders} from '@/lib/admin-access';
import {HubSpotError,testHubSpotConnection,hubspotConfigured,saveHubSpotToken,disconnectHubSpot,searchHubSpotContacts,getHubSpotContact} from '@/lib/hubspot';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:privateHeaders});
export async function POST(request:Request){
 const access=await accessStatus(request,'createEdit');
 if(access!==200)return json({error:access===401?'Sign in to the sales workspace.':'HubSpot is available to authorised workspace admins.'},access);
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Request origin is not allowed.'},403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'Send a JSON request.'},415);
 try{
  // Bound requests before parsing: even credential submissions stay small.
  const reader=request.body?.getReader();if(!reader)return json({error:'Missing request.'},400);
  const chunks:Uint8Array[]=[];let length=0;
  while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>8192){await reader.cancel();return json({error:'Request is too large.'},413);}chunks.push(value);}
  const raw=new Uint8Array(length);let offset=0;for(const chunk of chunks){raw.set(chunk,offset);offset+=chunk.length;}
  let body:any;try{body=JSON.parse(new TextDecoder().decode(raw));}catch{return json({error:'Invalid request.'},400);}
  if(!body||typeof body!=='object')return json({error:'Invalid request.'},400);
  if(!['status','search','contact'].includes(body.action)&&await adminAccess(request,env)!==200)return json({error:'Super Administrator access required.'},403);
  if(body.action==='status')return json({configured:await hubspotConfigured(),managedByHosting:!!env.HUBSPOT_ACCESS_TOKEN});
  if(body.action==='test'){await testHubSpotConnection();return json({ok:true});}
  if(body.action==='connect'){
   if(typeof body.token!=='string'||body.token.trim().length<20||body.token.length>1000||/\s/.test(body.token.trim()))return json({error:'Enter a valid HubSpot private-app access token.'},400);
   await saveHubSpotToken(body.token.trim());return json({configured:true});
  }
  if(body.action==='disconnect'){await disconnectHubSpot();return json({configured:false});}
  if(body.action==='search'){
   if(typeof body.query!=='string'||body.query.trim().length<2||body.query.length>200||(body.after!==undefined&&(typeof body.after!=='string'||!/^\d{1,8}$/.test(body.after))))return json({error:'Enter at least two characters of a name or email.'},400);
   return json(await searchHubSpotContacts(body.query.trim(),body.after));
  }
  if(body.action==='contact'&&typeof body.id==='string'&&/^\d{1,30}$/.test(body.id))return json(await getHubSpotContact(body.id));
  return json({error:'Invalid HubSpot request.'},400);
 }catch(error){return json({error:error instanceof HubSpotError?error.message:'Unable to complete the HubSpot request. Please try again.'},error instanceof HubSpotError?error.status:503);}
}
