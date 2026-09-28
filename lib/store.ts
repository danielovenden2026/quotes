import { env } from 'cloudflare:workers';
<<<<<<< HEAD
=======
import { authenticatedUserId } from './request-auth';

export function db() {
  if (!env.DB) throw new Error('Quote storage is unavailable. Please try again.');
  return env.DB;
}

export function owner(request: Request) {
  const id = authenticatedUserId(request);
  if (id) return id;
  if (import.meta.env.DEV) return 'local-preview';
  throw new Error('Please sign in to access your quotes.');
}

export function safeRequest(request: Request) {
  const origin = request.headers.get('origin');
>>>>>>> a5ef9eb0793d30a72833108875488ef628f721c8

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
<<<<<<< HEAD
  return Response.json(
    { error: e instanceof Error ? e.message : 'Unable to save. Please try again.' },
=======

  return Response.json(
    {
      error:
        e instanceof Error
          ? e.message
          : 'Unable to save. Please try again.',
    },
>>>>>>> a5ef9eb0793d30a72833108875488ef628f721c8
    { status: 400 },
  );
}
