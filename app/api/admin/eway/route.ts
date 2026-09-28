import {adminAccess,privateHeaders} from '@/lib/admin-access';
import {ewayStatus,EwayError,getEwayCredentials,saveEwayConnection,testEwayConnection,disconnectEway} from '@/lib/eway';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:privateHeaders});
async function deny(r:Request){const status=await adminAccess(r);return status===200?null:json({error:status===401?'Sign in to manage eWAY.':'Super Administrator access is required to manage eWAY.'},status);}
export async function GET(r:Request){const denied=await deny(r);if(denied)return denied;try{return json(await ewayStatus());}catch(e){return json({error:e instanceof EwayError?e.message:'eWAY status could not be loaded.'},503);}}
export async function POST(r:Request){
 const denied=await deny(r);if(denied)return denied;
 if(r.headers.get('origin')!==new URL(r.url).origin)return json({error:'Request origin is not allowed.'},403);
 if(!r.headers.get('content-type')?.startsWith('application/json'))return json({error:'Send a JSON request.'},415);
 try{
  const reader=r.body?.getReader();if(!reader)return json({error:'Missing request.'},400);let raw='',size=0;const decoder=new TextDecoder();
  try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>4096)return json({error:'Request is too large.'},413);raw+=decoder.decode(part.value,{stream:true});}raw+=decoder.decode();}finally{await reader.cancel();reader.releaseLock();}
  let body:any;try{body=JSON.parse(raw);}catch{return json({error:'Invalid request.'},400);}
  if(body?.action==='connect'){const status=await saveEwayConnection(body);return json({...status,message:status.testPaymentsEnabled?'eWAY credentials verified and saved. Sandbox checkout payments are enabled. No real money is taken.':'eWAY credentials verified and saved. Save separate Test (Sandbox) credentials to test checkout payments. Live payments are not enabled.'});}
  if(body?.action==='test'){const saved=await getEwayCredentials();if(!saved)throw new EwayError('Save an eWAY connection first.');await testEwayConnection(saved);return json({message:'Saved eWAY credentials verified. No payment was taken.'});}
  if(body?.action==='disconnect'){await disconnectEway();return json({configured:false,mode:'sandbox',verifiedAt:null,paymentsEnabled:false,message:'eWAY disconnected.'});}
  return json({error:'Invalid eWAY action.'},400);
 }catch(e){return json({error:e instanceof EwayError?e.message:'Unable to complete the eWAY request. Please try again.'},e instanceof EwayError?e.status:503);}
}
