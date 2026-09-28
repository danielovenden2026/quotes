import 'server-only';

/**
 * Auth compatibility for the independently hosted Cloudflare deployment.
 *
 * Cloudflare Access supplies the authenticated email in
 * Cf-Access-Authenticated-User-Email. The legacy ChatGPT/Sites headers are
 * retained as fallbacks so local tests and the original Work environment keep
 * working.
 */
export function authenticatedEmail(request: Request): string | null {
  const value =
    request.headers.get('Cf-Access-Authenticated-User-Email') ||
    request.headers.get('oai-authenticated-user-email');
  const email = value?.trim().toLowerCase();
  return email || null;
}

export function authenticatedUserId(request: Request): string | null {
  const legacy = request.headers.get('oai-authenticated-user-id')?.trim();
  if (legacy) return legacy;
  // Cloudflare Access email is stable for the same identity and is used as the
  // production user key when the ChatGPT/Sites user id is not available.
  return authenticatedEmail(request);
}

export function authenticatedFullName(request: Request): string | null {
  const raw = request.headers.get('oai-authenticated-user-full-name');
  if (!raw) return null;
  if (
    request.headers.get('oai-authenticated-user-full-name-encoding') ===
    'percent-encoded-utf-8'
  ) {
    try {
      return decodeURIComponent(raw);
    } catch {
      return null;
    }
  }
  return raw;
}

export function isAuthenticated(request: Request): boolean {
  return !!authenticatedUserId(request) && !!authenticatedEmail(request);
}
