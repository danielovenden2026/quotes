import {adminAccess,privateHeaders} from '@/lib/admin-access';
import {paypalStatus,PaypalError,getPaypalCredentials,savePaypalConnection,testPaypalConnection,disconnectPaypal} from '@/lib/paypal';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:privateHeaders});
async function deny(r:Request){const status=await adminAccess(r);return status===200?null:json({error:status===401?'Sign in to manage PayPal.':'Super Administrator access is required to manage PayPal.'},status);}
export async function GET(r:Request){const denied=await deny(r);if(denied)return denied;try{return json(await paypalStatus());}catch(e){return json({error:e instanceof PaypalError?e.message:'PayPal status could not be loaded.'},503);}}
export async function POST(r:Request){
 const denied=await deny(r);if(denied)return denied;
 if(r.headers.get('origin')!==new URL(r.url).origin)return json({error:'Request origin is not allowed.'},403);
 if(!r.headers.get('content-type')?.startsWith('application/json'))return json({error:'Send a JSON request.'},415);
 try{
  const reader=r.body?.getReader();if(!reader)return json({error:'Missing request.'},400);let raw='',size=0;const decoder=new TextDecoder();
  try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>4096)return json({error:'Request is too large.'},413);raw+=decoder.decode(part.value,{stream:true});}raw+=decoder.decode();}finally{await reader.cancel();reader.releaseLock();}
  let body:any;try{body=JSON.parse(raw);}catch{return json({error:'Invalid request.'},400);}
  if(body?.action==='connect'){const status=await savePaypalConnection(body);return json({...status,message:'PayPal credentials verified and saved. PayPal checkout payments are not enabled yet.'});}
  if(body?.action==='test'){const saved=await getPaypalCredentials();if(!saved)throw new PaypalError('Save a PayPal connection first.');await testPaypalConnection(saved);return json({message:'Saved PayPal credentials verified. No payment was taken.'});}
  if(body?.action==='disconnect'){await disconnectPaypal();return json({configured:false,mode:'sandbox',verifiedAt:null,paymentsEnabled:false,message:'PayPal disconnected.'});}
  return json({error:'Invalid PayPal action.'},400);
 }catch(e){return json({error:e instanceof PaypalError?e.message:'Unable to complete the PayPal request. Please try again.'},e instanceof PaypalError?e.status:503);}
}
