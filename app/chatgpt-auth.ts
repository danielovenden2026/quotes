import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export type ChatGPTUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

const CF_EMAIL_HEADER = 'cf-access-authenticated-user-email';
const LEGACY_USER_ID_HEADER = 'oai-authenticated-user-id';
const LEGACY_EMAIL_HEADER = 'oai-authenticated-user-email';
const LEGACY_FULL_NAME_HEADER = 'oai-authenticated-user-full-name';
const LEGACY_FULL_NAME_ENCODING_HEADER =
  'oai-authenticated-user-full-name-encoding';
const PERCENT_ENCODED_UTF8 = 'percent-encoded-utf-8';

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  const requestHeaders = await headers();
  const email = (
    requestHeaders.get(CF_EMAIL_HEADER) ||
    requestHeaders.get(LEGACY_EMAIL_HEADER)
  )
    ?.trim()
    .toLowerCase();
  if (!email) return null;

  const userId = requestHeaders.get(LEGACY_USER_ID_HEADER)?.trim() || email;
  const encodedFullName = requestHeaders.get(LEGACY_FULL_NAME_HEADER);
  const fullName =
    encodedFullName &&
    requestHeaders.get(LEGACY_FULL_NAME_ENCODING_HEADER) === PERCENT_ENCODED_UTF8
      ? safeDecodeURIComponent(encodedFullName)
      : encodedFullName;

  return {
    userId,
    displayName: fullName ?? email,
    email,
    fullName: fullName ?? null,
  };
}

export async function requireChatGPTUser(
  returnTo: string,
): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (user) return user;

  // On the independent deployment, Cloudflare Access owns the sign-in flow.
  // A missing identity generally means the request did not pass through the
  // Access application. Returning to the requested route lets Access challenge
  // the browser once the application policy is correctly attached.
  redirect(safeRelativeReturnPath(returnTo));
}

export function chatGPTSignInPath(returnTo: string): string {
  return safeRelativeReturnPath(returnTo);
}

export function chatGPTSignOutPath(returnTo = '/'): string {
  return safeRelativeReturnPath(returnTo);
}

function safeRelativeReturnPath(value: string): string {
  if (!value.startsWith('/') || value.startsWith('//')) return '/';
  let url: URL;
  try {
    url = new URL(value, 'https://app.local');
  } catch {
    return '/';
  }
  if (url.origin !== 'https://app.local') return '/';
  return `${url.pathname}${url.search}${url.hash}`;
}

function safeDecodeURIComponent(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
