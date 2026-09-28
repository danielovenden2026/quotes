import 'server-only';
import {env} from 'cloudflare:workers';
export type ApprovalSettings={highValueCents:number};
export function parseApprovalSettings(value:any):ApprovalSettings{if(!Number.isSafeInteger(value?.highValueCents)||value.highValueCents<0||value.highValueCents>10000000000)throw Error('Enter a valid approval amount from $0 to $100,000,000.');return {highValueCents:value.highValueCents};}
export async function getApprovalSettings():Promise<ApprovalSettings>{const row=await env.BUCKET?.get('workspace/approval/settings-v1');return row?parseApprovalSettings(await row.json()):{highValueCents:1000000};}
export async function saveApprovalSettings(value:unknown){const settings=parseApprovalSettings(value);if(!env.BUCKET)throw Error('Settings storage unavailable.');await env.BUCKET.put('workspace/approval/settings-v1',JSON.stringify(settings));return settings;}
