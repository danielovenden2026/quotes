import {accessStatus,actor} from '@/lib/workspace-access';
import {env} from 'cloudflare:workers';
import {adminAccess,privateHeaders} from '@/lib/admin-access';
import {estimateMagento,FreightError,getMagentoSettings,saveMagentoSettings,storeSchema} from '@/lib/magento-freight';
import {z} from 'zod';
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:privateHeaders});
async function denied(request:Request){const status=await accessStatus(request,'createEdit');return status===200?null:json({error:status===401?'Sign in to use Magento freight.':'Magento freight is available to authorised workspace users.'},status);}
export async function GET(request:Request){const deny=await denied(request);if(deny)return deny;try{return json(await getMagentoSettings());}catch{return json({error:'Magento settings could not be loaded.'},503);}}
const running=new Set<string>();
export async function POST(request:Request){
 const deny=await denied(request);if(deny)return deny;
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Request origin is not allowed.'},403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'Send a JSON request.'},415);
 let body:any;try{const reader=request.body?.getReader();if(!reader)throw Error();let bytes=0,text='';const decoder=new TextDecoder();try{for(;;){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>20000)throw Error();text+=decoder.decode(part.value,{stream:true});}body=JSON.parse(text+decoder.decode());}finally{await reader.cancel();reader.releaseLock();}}catch{return json({error:'Invalid freight request.'},400);}
 if(body?.action!=='estimate'&&await adminAccess(request,env)!==200)return json({error:'Super Administrator access required.'},403);
 if(!['test','estimate','disconnect'].includes(body?.action))return json({error:'Invalid freight action.'},400);
 const user=(await actor(request)).id;
 if(running.has(user))return json({error:'A freight calculation is already running. Please wait.'},429);
 running.add(user);
 try{
  const settings=await getMagentoSettings();
  if(body.action==='disconnect'){await saveMagentoSettings({...settings,enabled:false});return json({enabled:false});}
  if(body.action==='test'){
   const storeCode=storeSchema.parse(body.storeCode),rates=await estimateMagento(storeCode,{state:'NSW',postcode:'2121',items:[{sku:'V4020',qty:1}]});
   const next={storeCode,enabled:true,testedAt:new Date().toISOString(),testAmount:rates[0].amount};await saveMagentoSettings(next);
   return json({...next,rates,expectedAmount:8182,matchesExample:rates.some(r=>r.amount===8182)});
  }
  if(!settings.enabled)return json({error:'Test and enable Magento Freight in Workspace connections first.'},409);
  const rates=await estimateMagento(settings.storeCode,body.shipment);
  return json({rates,calculatedAt:new Date().toISOString()});
 }catch(error){if(error instanceof FreightError)return json({error:error.message,...(error.diagnostics?{diagnostics:error.diagnostics}:{})},502);if(error instanceof z.ZodError)return json({error:'Check the state, four-digit postcode, product quantities and store code.'},400);return json({error:'Freight could not be calculated. Your existing freight amount has been retained.'},503);}finally{running.delete(user);}
}
