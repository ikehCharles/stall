const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN");

/**
 * Returns CORS headers scoped to the configured ALLOWED_ORIGIN.
 * Falls back to "*" when ALLOWED_ORIGIN is not set (local dev).
 */
export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowOrigin = ALLOWED_ORIGIN
    ? (origin === ALLOWED_ORIGIN ? origin : "")
    : "*";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };
}
