import { describe, it, expect, afterAll } from 'vitest';
import { buildTestApp } from '../helpers/build-test-app.js';

// Shrink the write limit to 2/min so we can exhaust it quickly; reads stay high.
const { app, tokens } = await buildTestApp({
  patch: (c) => {
    c.rateLimits.write = { max: 2, timeWindow: '1 minute' };
    c.rateLimits.auth = { max: 2, timeWindow: '1 minute' };
  },
});
afterAll(() => app.close());
const auth = (t: string) => ({ authorization: `Bearer ${t}` });
const putBody = {
  name: 'X',
  type: 'Restaurant',
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'opening-hours': 'h',
  image: 'https://x',
  coordinates: 'x=1,y=1',
  radius: 1,
};

describe('rate limiting', () => {
  it('returns 429 (problem) once the write limit is exceeded, with Retry-After', async () => {
    const url = '/locations/cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    expect(
      (await app.inject({ method: 'PUT', url, headers: auth(tokens.writer), payload: putBody }))
        .statusCode,
    ).toBeLessThan(400);
    expect(
      (await app.inject({ method: 'PUT', url, headers: auth(tokens.writer), payload: putBody }))
        .statusCode,
    ).toBeLessThan(400);
    const res = await app.inject({
      method: 'PUT',
      url,
      headers: auth(tokens.writer),
      payload: putBody,
    });
    expect(res.statusCode).toBe(429);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.json()).toMatchObject({ status: 429, title: 'Too Many Requests' });
    expect(res.headers['retry-after']).toBeDefined();
  });
  it('the auth endpoint has its own (strict) limit', async () => {
    await app.inject({ method: 'POST', url: '/auth/token', payload: { username: 'x', password: 'y' } });
    await app.inject({ method: 'POST', url: '/auth/token', payload: { username: 'x', password: 'y' } });
    const res = await app.inject({
      method: 'POST',
      url: '/auth/token',
      payload: { username: 'x', password: 'y' },
    });
    expect(res.statusCode).toBe(429);
  });
  it('reads are not throttled at the same low rate', async () => {
    for (let i = 0; i < 10; i++) {
      const res = await app.inject({
        method: 'GET',
        url: '/locations/search?x=3&y=2',
        headers: auth(tokens.reader),
      });
      expect(res.statusCode).toBe(200);
    }
  });
});
