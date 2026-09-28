import {authenticatedEmail} from '@/lib/request-auth';
import {costAccess, privateHeaders, escapeHtml} from '@/lib/admin-access';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const access = await costAccess(request);
  const body = access !== 200
    ? '<p>Sign in through Cloudflare Access to view Unit Cost and GP in Sales Workspace.</p><a href="/workspace" target="_top">Open Sales Workspace</a>'
    : '<p>Signed in as <strong>' + escapeHtml(authenticatedEmail(request) || 'authenticated user') + '</strong>.</p><p>Your account can view Unit Cost and GP in Sales Workspace.</p><a href="/workspace" target="_top">Open Sales Workspace</a>';
  return new Response('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Verdex — Workspace access</title><style>body{font:16px/1.6 Arial,sans-serif;color:#142a3d;background:#e5ebf1;margin:0;padding:32px}main{max-width:650px;background:white;border:1px solid #bacbd9;border-radius:8px;padding:32px;margin:5vh auto}h1{font-size:28px}a{color:#005c99}code{display:block;padding:14px;background:#eef4f8;overflow-wrap:anywhere;user-select:all}</style></head><body><main><h1>Verdex workspace access</h1>' + body + '</main></body></html>', {headers:{...privateHeaders, 'Content-Type':'text/html; charset=utf-8', 'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"}});
}
