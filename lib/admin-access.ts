import 'server-only';
import {accessStatus} from './workspace-access';
export const staffAccess=(request:Request)=>accessStatus(request);
export const costAccess=(request:Request)=>accessStatus(request,'viewCosts');
export type AdminConfig={COST_ADMIN_USER_IDS?:string};
export const adminAccess=(request:Request,_config?:AdminConfig)=>accessStatus(request,'superAdmin');

export const privateHeaders = {
  'Cache-Control': 'private, no-store, max-age=0',
  'CDN-Cache-Control': 'no-store',
  'Vary': 'Cookie, Cf-Access-Authenticated-User-Email, oai-authenticated-user-id, oai-authenticated-user-email',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]!));
}
