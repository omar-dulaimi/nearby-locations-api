// test/integration/auth.test.ts
import { describe, it, expect, afterAll } from 'vitest';
import { buildTestApp } from '../helpers/build-test-app.js';

const { app, passwords } = await buildTestApp();
afterAll(() => app.close());

describe('POST /auth/token', () => {
  it('issues a token for valid credentials with a role claim', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/token',
      payload: { username: 'writer', password: passwords.writer },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({ token_type: 'Bearer', expires_in: expect.any(Number) });
    expect(typeof body.access_token).toBe('string');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const decoded = (app as any).jwt.decode(body.access_token);
    expect(decoded).toMatchObject({ sub: 'writer', role: 'writer' });
  });
  it('rejects bad credentials with a 401 problem', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/token',
      payload: { username: 'writer', password: 'nope' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.json()).toMatchObject({ status: 401, title: 'Unauthorized' });
  });
  it('rejects an unknown user with 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/token',
      payload: { username: 'ghost', password: 'x' },
    });
    expect(res.statusCode).toBe(401);
  });
  it('rejects a malformed body with a 400 problem (validation)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/token',
      payload: { username: 'writer' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ status: 400, errors: expect.any(Array) });
  });
});
