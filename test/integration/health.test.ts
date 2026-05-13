// test/integration/health.test.ts
import { describe, it, expect, afterAll } from 'vitest';
import { buildTestApp } from '../helpers/build-test-app.js';

const { app } = await buildTestApp();
afterAll(() => app.close());

describe('GET /health', () => {
  it('returns ok with the loaded count', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', locationsLoaded: 5 }); // sample fixture has 5
  });
});

describe('GET /', () => {
  it('redirects to /docs', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/docs');
  });
});
