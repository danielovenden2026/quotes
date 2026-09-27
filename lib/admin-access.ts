import 'server-only';

export type AdminConfig = { COST_ADMIN_USER_IDS?: string };
export function adminAccess(request: Request, config: AdminConfig): 200 | 401 | 403 {
  const id = request.headers.get('oai-authenticated-user-id');
  const email = request.headers.get('oai-authenticated-user-email');
  if (!id || !email) return 401;
  const allowed = (config.COST_ADMIN_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  // No development bypass, self-enrolment, email/domain inference, or first-user grant.
  return allowed.includes(id) ? 200 : 403;
}

export const privateHeaders = {
  'Cache-Control': 'private, no-store, max-age=0',
  'CDN-Cache-Control': 'no-store',
  'Vary': 'Cookie, oai-authenticated-user-id, oai-authenticated-user-email',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]!));
}
