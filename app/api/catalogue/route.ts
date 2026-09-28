import {getAutoOptionsSettings} from '@/lib/auto-options-settings';
import {getCatalogue} from '@/lib/catalogue-data';
export const dynamic='force-dynamic';
export async function GET(){try{const [catalogue,settings]=await Promise.all([getCatalogue(),getAutoOptionsSettings()]);return Response.json({...catalogue,autoOptionsLimit:settings.maxOptions},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'The product catalogue could not be loaded. Please try again.'},{status:503,headers:{'Cache-Control':'no-store'}});}}
