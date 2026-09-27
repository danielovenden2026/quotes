export function safeRequest(request: Request) {
  const origin = request.headers.get('origin');

  if (origin && origin !== new URL(request.url).origin) {
    throw new Error('Request origin is not allowed.');
  }
}

export function fail(e: unknown) {
  console.error(e);

  return Response.json(
    {
      error:
        e instanceof Error
          ? e.message
          : 'Unable to save. Please try again.',
    },
    { status: 400 },
  );
}
