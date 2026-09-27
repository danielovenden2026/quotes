import {env} from 'cloudflare:workers';
import {adminAccess, privateHeaders, escapeHtml} from '@/lib/admin-access';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const access = adminAccess(request, env);
  const body = access === 401
    ? '<p>Sign in to identify your account for admin access.</p><a href="/signin-with-chatgpt?return_to=%2Fadmin%2Faccess" target="_top">Sign in with ChatGPT</a>'
    : '<p>Signed in as <strong>' + escapeHtml(request.headers.get('oai-authenticated-user-email')!) + '</strong>.</p>' + (access === 200
      ? '<p>Your account has permission to view Unit Cost.</p><a href="/workspace" target="_top">Open Sales workspace</a>'
      : '<p>Cost access is locked. Send the account ID below to the person configuring your quoting app so they can enable your admin access.</p><p><strong>Your account ID</strong></p><code>' + escapeHtml(request.headers.get('oai-authenticated-user-id')!) + '</code><p>This identifies your account; it is not a password. Signing in alone does not grant cost access.</p>');
  return new Response('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Verdex — Admin access</title><style>body{font:16px/1.6 Arial,sans-serif;color:#173449;background:#f3f7fa;margin:0;padding:32px}main{max-width:650px;background:white;border:1px solid #dbe4ec;border-radius:8px;padding:32px;margin:5vh auto}h1{font-size:28px}a{color:#0765ac}code{display:block;padding:14px;background:#eef4f8;overflow-wrap:anywhere;user-select:all}</style></head><body><main><h1>Verdex admin access</h1>' + body + '</main></body></html>', {headers:{...privateHeaders, 'Content-Type':'text/html; charset=utf-8', 'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"}});
}
