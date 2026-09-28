import 'server-only';
import {env} from 'cloudflare:workers';
export type AutoOptionsSettings={maxOptions:number};
const key='workspace/auto-options/settings-v1';
export function parseAutoOptionsSettings(value:unknown):AutoOptionsSettings{
 const maxOptions=(value as Partial<AutoOptionsSettings>|null)?.maxOptions;
 if(typeof maxOptions!=='number'||!Number.isInteger(maxOptions)||maxOptions<0||maxOptions>50)throw Error('Enter a whole number from 0 to 50 for the automatic options limit.');
 return {maxOptions};
}
export async function getAutoOptionsSettings():Promise<AutoOptionsSettings>{
 const stored=await env.BUCKET?.get(key);
 return stored?parseAutoOptionsSettings(await stored.json()):{maxOptions:20};
}
export async function saveAutoOptionsSettings(value:unknown):Promise<AutoOptionsSettings>{
 const settings=parseAutoOptionsSettings(value);
 if(!env.BUCKET)throw Error('Workspace settings could not be saved. Please try again.');
 await env.BUCKET.put(key,JSON.stringify(settings),{httpMetadata:{contentType:'application/json'}});
 return settings;
}
