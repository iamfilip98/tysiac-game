/** JSON response that is never cached (API answers are per-request). */
export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
}
