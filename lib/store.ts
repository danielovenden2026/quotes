import { env } from 'cloudflare:workers';

export function db() {
  if (!env.DB) throw new Error('Quote storage is unavailable. Please try again.');
  return env.DB;
}

export function safeRequest(request: Request) {
  const origin = request.headers.get('origin');
  // GET/navigation requests may legitimately omit Origin. Only reject a
  // supplied cross-origin value.
  if (origin && origin !== new URL(request.url).origin) {
    throw new Error('Request origin is not allowed.');
  }
}

export function fail(e: unknown) {
  console.error(e);
  return Response.json(
    { error: e instanceof Error ? e.message : 'Unable to save. Please try again.' },
    { status: 400 },
  );
}
