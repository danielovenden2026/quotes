export function safeRequest(request: Request) {
  const origin = request.headers.get("origin");

  if (origin && origin !== new URL(request.url).origin) {
    throw new Error("Request origin is not allowed.");
  }
}

export function fail(error: unknown) {
  console.error(error);

  return Response.json(
    {
      error:
        error instanceof Error
          ? error.message
          : "Unable to save. Please try again.",
    },
    { status: 400 },
  );
}