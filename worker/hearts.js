/**
 * Request parsing for the hearts API, kept free of Workers-only imports so
 * it can be unit-tested in Node.
 *
 *   GET    /api/hearts            → { counts: { [videoId]: n } }
 *   PUT    /api/hearts/:videoId   → { id, count }   (X-Visitor: <uuid>)
 *   DELETE /api/hearts/:videoId   → { id, count }   (X-Visitor: <uuid>)
 */

export const VIDEO_ID = /^[\w-]{11}$/;
export const VISITOR_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const fail = (status, error) => ({ kind: 'error', status, error });

/**
 * What a request asks for: `{ kind: 'counts' }`,
 * `{ kind: 'heart', video, visitor, on }`, or `{ kind: 'error', status, error }`.
 * Whether the video is in the lineup is checked separately, since that needs
 * the lineup.
 */
export const parseHeartRequest = (request) => {
  const { pathname } = new URL(request.url);
  const path = pathname.replace(/\/+$/, '');

  if (path === '/api/hearts') {
    return request.method === 'GET' ? { kind: 'counts' } : fail(405, 'method not allowed');
  }

  const match = path.match(/^\/api\/hearts\/([^/]+)$/);
  if (!match) return fail(404, 'not found');
  if (request.method !== 'PUT' && request.method !== 'DELETE') return fail(405, 'method not allowed');

  const video = decodeURIComponent(match[1]);
  if (!VIDEO_ID.test(video)) return fail(400, 'bad video id');
  const visitor = request.headers.get('X-Visitor') ?? '';
  if (!VISITOR_ID.test(visitor)) return fail(400, 'missing or bad X-Visitor');

  return { kind: 'heart', video, visitor: visitor.toLowerCase(), on: request.method === 'PUT' };
};

export const json = (body, { status = 200, headers = {} } = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
