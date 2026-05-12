import { describe, it, expect, afterAll } from 'vitest';
import { buildTestApp } from '../helpers/build-test-app.js';

const { app, tokens } = await buildTestApp();
afterAll(() => app.close());
const auth = (t: string) => ({ authorization: `Bearer ${t}` });

describe('HTTP caching', () => {
  it('sets an ETag and supports If-None-Match -> 304 on the detail endpoint', async () => {
    const url = '/locations/51e1545c-8b65-4d83-82f9-7fcad4a23111';
    const first = await app.inject({ method: 'GET', url, headers: auth(tokens.reader) });
    expect(first.statusCode).toBe(200);
    const etag = first.headers.etag;
    expect(etag).toBeTruthy();
    expect(first.headers['cache-control']).toContain('private');
    const second = await app.inject({
      method: 'GET',
      url,
      headers: { ...auth(tokens.reader), 'if-none-match': String(etag) },
    });
    expect(second.statusCode).toBe(304);
  });
  it('search responses are private; /health is public', async () => {
    const s = await app.inject({
      method: 'GET',
      url: '/locations/search?x=3&y=2',
      headers: auth(tokens.reader),
    });
    expect(s.headers['cache-control']).toContain('private');
    const h = await app.inject({ method: 'GET', url: '/health' });
    expect(h.headers['cache-control']).toContain('public');
  });
});
