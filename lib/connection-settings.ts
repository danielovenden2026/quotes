import 'server-only';
import {env} from 'cloudflare:workers';
import {FEED_URL} from './product-feed';
export type SheetSettings={sheetId:string;tab:string;mode:string;refreshMinutes:number};
export type FeedSettings={url:string;refreshMinutes:number};
export function parseRefreshMinutes(value:unknown):number {
 if(value===undefined)return 15;
 if(typeof value!=='number'||!Number.isInteger(value)||value<1||value>1440)throw Error('Refresh interval must be a whole number from 1 to 1440 minutes.');
 return value;
}
export function parseSheetSettings(value:any):SheetSettings {
 let sheetId=typeof value?.sheetId==='string'?value.sheetId.trim():'';
 if(sheetId.startsWith('https://')){const url=new URL(sheetId);if(url.hostname!=='docs.google.com')throw Error('Use a Google Sheets link or spreadsheet ID.');sheetId=url.pathname.match(/^\/spreadsheets\/d\/([A-Za-z0-9_-]+)/)?.[1]||'';}
 const tab=typeof value?.tab==='string'?value.tab.trim():'';
 if(!/^[A-Za-z0-9_-]{20,200}$/.test(sheetId))throw Error('Enter a valid spreadsheet ID or Google Sheets link.');
 if(!tab||tab.length>100)throw Error('Enter a sheet tab name up to 100 characters.');
 return {sheetId,tab,mode:'public-sheet',refreshMinutes:parseRefreshMinutes(value?.refreshMinutes)};
}
export function parseFeedSettings(value:any):FeedSettings {
 let url:URL;try{url=new URL(value?.url);}catch{throw Error('Enter a valid product feed URL.');}
 if(url.protocol!=='https:'||!['verdex.com.au','www.verdex.com.au'].includes(url.hostname)||url.port||url.username||url.password||url.search||url.hash||!/^\/media\/.*\.xml$/i.test(url.pathname))throw Error('Use a public HTTPS XML feed under verdex.com.au/media/.');
 return {url:url.href,refreshMinutes:parseRefreshMinutes(value?.refreshMinutes)};
}
async function read(key:string){const object=await env.BUCKET?.get('integrations/'+key+'/settings-v1');return object?object.json<any>():null;}
export async function getSheetSettings():Promise<SheetSettings>{const stored=await read('google-sheet');return stored?parseSheetSettings(stored):{sheetId:env.COST_SHEET_ID||'',tab:env.COST_SHEET_TAB||'Costs',mode:env.COST_SOURCE_MODE||'public-sheet',refreshMinutes:15};}
export async function getExoSettings():Promise<SheetSettings>{const stored=await read('exo-products');if(stored)return parseSheetSettings(stored);const sheet=await getSheetSettings();return {sheetId:sheet.sheetId,tab:'exo',mode:'public-sheet',refreshMinutes:15};}
export async function getFeedSettings():Promise<FeedSettings>{const stored=await read('product-feed');return stored?parseFeedSettings(stored):{url:FEED_URL,refreshMinutes:15};}
export async function saveConnectionSettings(kind:'sheet'|'feed'|'exo',value:SheetSettings|FeedSettings){
 if(!env.BUCKET)throw Error('Connection storage is unavailable. Please try again.');
 const settings=kind==='feed'?parseFeedSettings(value):parseSheetSettings(value);
 await env.BUCKET.put('integrations/'+(kind==='sheet'?'google-sheet':kind==='exo'?'exo-products':'product-feed')+'/settings-v1',JSON.stringify(settings),{httpMetadata:{contentType:'application/json'}});
}
