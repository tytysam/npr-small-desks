import { parseHeartRequest } from './hearts';

const VISITOR = '11111111-2222-4333-8444-555555555555';
const req = (method, path, headers = {}) => new Request(`https://example.com${path}`, { method, headers });

describe('parseHeartRequest', () => {
  it('reads the counts', () => {
    expect(parseHeartRequest(req('GET', '/api/hearts'))).toEqual({ kind: 'counts' });
    expect(parseHeartRequest(req('GET', '/api/hearts/'))).toEqual({ kind: 'counts' });
  });

  it('hearts and un-hearts a concert', () => {
    expect(parseHeartRequest(req('PUT', '/api/hearts/73wCQRQb7v0', { 'X-Visitor': VISITOR }))).toEqual({
      kind: 'heart',
      video: '73wCQRQb7v0',
      visitor: VISITOR,
      on: true,
    });
    expect(parseHeartRequest(req('DELETE', '/api/hearts/_Mp_bpIZKlI', { 'X-Visitor': VISITOR }))).toMatchObject({
      video: '_Mp_bpIZKlI',
      on: false,
    });
  });

  it('lower-cases the visitor, so one visitor is one row', () => {
    const parsed = parseHeartRequest(req('PUT', '/api/hearts/73wCQRQb7v0', { 'X-Visitor': VISITOR.toUpperCase() }));
    expect(parsed.visitor).toBe(VISITOR);
  });

  it('rejects bad video ids and visitors', () => {
    expect(parseHeartRequest(req('PUT', '/api/hearts/short', { 'X-Visitor': VISITOR }))).toMatchObject({ status: 400 });
    expect(parseHeartRequest(req('PUT', '/api/hearts/73wCQRQb7v0'))).toMatchObject({ status: 400 });
    expect(parseHeartRequest(req('PUT', '/api/hearts/73wCQRQb7v0', { 'X-Visitor': 'me' }))).toMatchObject({ status: 400 });
  });

  it('rejects other methods and paths', () => {
    expect(parseHeartRequest(req('POST', '/api/hearts'))).toMatchObject({ status: 405 });
    expect(parseHeartRequest(req('GET', '/api/hearts/73wCQRQb7v0'))).toMatchObject({ status: 405 });
    expect(parseHeartRequest(req('GET', '/api/hearts/73wCQRQb7v0/x'))).toMatchObject({ status: 404 });
  });
});
