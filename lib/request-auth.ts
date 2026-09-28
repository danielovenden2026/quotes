import 'server-only';
/** Legacy identity compatibility retained only for migration from Cloudflare Access / ChatGPT Sites. */
export function authenticatedEmail(request:Request){const value=request.headers.get('Cf-Access-Authenticated-User-Email')||request.headers.get('oai-authenticated-user-email');const email=value?.trim().toLowerCase();return email||null;}
export function authenticatedUserId(request:Request){const legacy=request.headers.get('oai-authenticated-user-id')?.trim();if(legacy)return legacy;return authenticatedEmail(request);}
export function authenticatedFullName(request:Request){const raw=request.headers.get('oai-authenticated-user-full-name');if(!raw)return null;if(request.headers.get('oai-authenticated-user-full-name-encoding')==='percent-encoded-utf-8'){try{return decodeURIComponent(raw);}catch{return null;}}return raw;}
export function hasLegacyAuthentication(request:Request){return !!authenticatedUserId(request)&&!!authenticatedEmail(request);}
export const isAuthenticated=hasLegacyAuthentication;
