// test/integration/errors.test.ts
import { describe, it, expect, afterAll } from 'vitest';
import { buildTestApp } from '../helpers/build-test-app.js';

const { app } = await buildTestApp();
afterAll(() => app.close());

describe('error handling', () => {
  it('unknown routes return an RFC 7807 problem', async () => {
    const res = await app.inject({ method: 'GET', url: '/no/such/path' });
    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toContain('application/problem+json');
    const body = res.json();
    expect(body).toMatchObject({
      type: expect.any(String),
      title: 'Not Found',
      status: 404,
      instance: '/no/such/path',
    });
    expect(typeof body.detail).toBe('string');
  });
});
