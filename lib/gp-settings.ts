import 'server-only';
import {env} from 'cloudflare:workers';
export type GpSettings={targetPct:number;minimumSavePct:number};
const key='workspace/gp-target/settings-v1';
export function parseGpSettings(value:unknown):GpSettings{
 const targetPct=(value as Partial<GpSettings>|null)?.targetPct;
 if(typeof targetPct!=='number'||!Number.isFinite(targetPct)||targetPct<0||targetPct>100||Math.abs(targetPct*10-Math.round(targetPct*10))>1e-8)throw Error('Enter a GP target between 0 and 100, with up to one decimal place.');
 const minimumSavePct=(value as Partial<GpSettings>).minimumSavePct??20;
 if(typeof minimumSavePct!=='number'||!Number.isFinite(minimumSavePct)||minimumSavePct<0||minimumSavePct>100||Math.abs(minimumSavePct*10-Math.round(minimumSavePct*10))>1e-8)throw Error('Enter a minimum GP between 0 and 100, with up to one decimal place.');
 return {targetPct,minimumSavePct};
}
export async function getGpSettings():Promise<GpSettings>{
 const stored=await env.BUCKET?.get(key);
 return stored?parseGpSettings(await stored.json()):{targetPct:40,minimumSavePct:20};
}
export async function saveGpSettings(value:unknown):Promise<GpSettings>{
 const settings=parseGpSettings(value);
 if(!env.BUCKET)throw Error('Workspace settings could not be saved. Please try again.');
 await env.BUCKET.put(key,JSON.stringify(settings),{httpMetadata:{contentType:'application/json'}});
 return settings;
}
