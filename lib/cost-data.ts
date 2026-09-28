import 'server-only';
import {createCostCache,createCostSource,type CostRecords} from './cost-source';
import {getSheetSettings,type SheetSettings} from './connection-settings';
let load:ReturnType<typeof createCostCache>|undefined,sourceKey='';
export async function getCosts(refresh=false){
 const settings=await getSheetSettings(),key=JSON.stringify(settings);
 if(refresh||key!==sourceKey){load=undefined;sourceKey=key;}
 load??=createCostCache(createCostSource({COST_SHEET_ID:settings.sheetId,COST_SHEET_TAB:settings.tab,COST_SOURCE_MODE:settings.mode}),Date.now,undefined,settings.refreshMinutes);
 return load();
}

export function seedCosts(settings:SheetSettings,records:CostRecords){
 sourceKey=JSON.stringify(settings);
 load=createCostCache(createCostSource({COST_SHEET_ID:settings.sheetId,COST_SHEET_TAB:settings.tab,COST_SOURCE_MODE:settings.mode}),Date.now,records,settings.refreshMinutes);
}
