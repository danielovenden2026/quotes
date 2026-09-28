import {getApprovalSettings,saveApprovalSettings} from '@/lib/approval-settings';
import {fetchExoCatalogue,getExoCatalogue,seedExoCatalogue} from '@/lib/exo-catalogue';
import {getAutoOptionsSettings,saveAutoOptionsSettings} from '@/lib/auto-options-settings';
import {getGpSettings,saveGpSettings} from '@/lib/gp-settings';
import {env} from 'cloudflare:workers';
import {adminAccess,privateHeaders} from '@/lib/admin-access';
import {getSheetSettings,getFeedSettings,getExoSettings,parseSheetSettings,parseFeedSettings,saveConnectionSettings} from '@/lib/connection-settings';
import {createCostSource} from '@/lib/cost-source';
import {getCosts,seedCosts} from '@/lib/cost-data';
import {fetchCatalogue,getCatalogue,seedCatalogue} from '@/lib/catalogue-data';
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:privateHeaders});
async function deny(request:Request){const status=await adminAccess(request,env);return status===200?null:json({error:status===401?'Sign in to manage workspace connections.':'Only authorised workspace admins can manage connections.'},status);}
export async function GET(request:Request){const denied=await deny(request);if(denied)return denied;try{const [sheet,feed,gp,autoOptions,exo,approval]=await Promise.all([getSheetSettings(),getFeedSettings(),getGpSettings(),getAutoOptionsSettings(),getExoSettings(),getApprovalSettings()]);return json({sheet,feed,gp,autoOptions,exo,approval});}catch{return json({error:'Connection settings could not be loaded.'},503);}}
export async function POST(request:Request){
 const denied=await deny(request);if(denied)return denied;
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Request origin is not allowed.'},403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'Send a JSON request.'},415);
 let body:any;
 try{const reader=request.body?.getReader();if(!reader)throw Error();const decoder=new TextDecoder();let raw='',size=0;try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>8192)throw Error();raw+=decoder.decode(part.value,{stream:true});}raw+=decoder.decode();}finally{await reader.cancel();reader.releaseLock();}body=JSON.parse(raw);}catch{return json({error:'Invalid connection request.'},400);}
 if(!['sheet','feed','gp','autoOptions','exo','approval'].includes(body?.kind)||!['test','save','refresh'].includes(body?.action))return json({error:'Invalid connection action.'},400);
 try{
  if(body.kind==='approval'){if(body.action!=='save')return json({error:'Invalid approval action.'},400);return json({settings:await saveApprovalSettings(body.settings),message:'Quote approval limit saved.'});}
  if(body.kind==='autoOptions'){if(body.action!=='save')return json({error:'Invalid automatic options settings action.'},400);const settings=await saveAutoOptionsSettings(body.settings);return json({settings,message:'Automatic options limit saved.'});}
  if(body.kind==='gp'){if(body.action!=='save')return json({error:'Invalid GP settings action.'},400);const settings=await saveGpSettings(body.settings);return json({settings,message:'GP target saved.'});}
  if(body.kind==='exo'){
   if(body.action==='refresh'){const data=await getExoCatalogue(true);return json({message:'EXO products refreshed.',count:data.products.length,skipped:data.skipped});}
   const settings=parseSheetSettings(body.settings),data=await fetchExoCatalogue(settings);
   if(body.action==='save'){await saveConnectionSettings('exo',settings);seedExoCatalogue(settings,data);}
   return json({message:body.action==='save'?'EXO connection saved.':'EXO connection verified.',count:data.products.length,skipped:data.skipped,...(body.action==='save'?{settings}:{})});
  }
  if(body.kind==='sheet'){
   if(body.action==='refresh'){const records=await getCosts(true);return json({message:'Costs and stock refreshed.',count:records.size});}
   const settings=parseSheetSettings(body.settings);
   const records=await createCostSource({COST_SHEET_ID:settings.sheetId,COST_SHEET_TAB:settings.tab,COST_SOURCE_MODE:settings.mode}).load();
   if(!records.size)throw Error('No SKU rows were found in this sheet.');
   if(body.action==='save'){await saveConnectionSettings('sheet',settings);seedCosts(settings,records);}
   return json({message:body.action==='save'?'Google Sheet connection saved.':'Google Sheet connection verified.',count:records.size,...(body.action==='save'?{settings}:{})});
  }
  if(body.action==='refresh'){const catalogue=await getCatalogue(true);if(catalogue.warning)throw Error('The XML feed could not be refreshed. Existing catalogue data has been retained.');return json({message:'Product feed refreshed.',count:catalogue.products.length});}
  const settings=parseFeedSettings(body.settings),catalogue=await fetchCatalogue(settings.url);
  if(body.action==='save'){await saveConnectionSettings('feed',settings);seedCatalogue(settings.url,catalogue,settings.refreshMinutes);}
  return json({message:body.action==='save'?'XML feed connection saved.':'XML feed connection verified.',count:catalogue.products.length,...(body.action==='save'?{settings}:{})});
 }catch(error){return json({error:error instanceof Error?error.message:'Connection could not be verified. Existing settings were retained.'},400);}
}
